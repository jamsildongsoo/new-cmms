/** 회사·모듈·발급월별 문서 채번, 동일 생성 요청의 재시도, 저장 후 첨부 연결을 공통 처리한다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { AppModuleKey, findModule } from '../common/constants/modules';
import type { UserContext } from '../auth/types/user-context.type';
import { Attachment } from '../attachments/entities/attachment.entity';
import { DocumentRequest } from './entities/document-request.entity';
import { NumberSequence } from './entities/number-sequence.entity';

@Injectable()
export class NumberingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async lock(manager: EntityManager, key: string) {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [key],
    );
  }

  // 업무 날짜와 무관하게 최초 발급월을 한국 시간으로 고정한다.
  yearMonth(date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    return `${parts.find((p) => p.type === 'year')!.value}${parts.find((p) => p.type === 'month')!.value}`;
  }

  async generateDocumentId(
    companyId: string,
    moduleKey: AppModuleKey,
    date = new Date(),
  ): Promise<string> {
    const module = findModule(moduleKey);
    if (!module || !('documentPrefix' in module))
      throw new BadRequestException('채번 대상 모듈이 아닙니다.');
    const prefix = module.documentPrefix;
    const yyyymm = this.yearMonth(date);
    return this.db.transaction((manager) =>
      this.next(manager, companyId, prefix, yyyymm),
    );
  }

  private async next(
    manager: EntityManager,
    companyId: string,
    prefix: string,
    yyyymm: string,
  ) {
    await this.lock(
      manager,
      `document-number:${companyId}:${prefix}:${yyyymm}`,
    );
    const repo = manager.getRepository(NumberSequence);
    const where = { companyId, moduleCode: prefix, yyyymm };
    const row =
      (await repo.findOneBy(where)) ?? repo.create({ ...where, lastSerial: 0 });
    if (row.lastSerial >= 99999)
      throw new ConflictException('월별 문서번호 발급 한도를 초과했습니다.');
    row.lastSerial += 1;
    await repo.save(row);
    return `${prefix}-${yyyymm}-${String(row.lastSerial).padStart(5, '0')}`;
  }

  /** 번호 예약은 문서 저장과 별도로 확정한다. 실패 번호를 재사용하지 않는다. */
  private async reserve(
    user: UserContext,
    moduleKey: AppModuleKey,
    requestKey: string,
  ) {
    if (!isUUID(requestKey))
      throw new BadRequestException(
        '유효한 Idempotency-Key 헤더가 필요합니다.',
      );
    return this.db.transaction(async (manager) => {
      await this.lock(
        manager,
        `document-reserve:${user.companyId}:${moduleKey}:${requestKey}`,
      );
      const repo = manager.getRepository(DocumentRequest);
      const where = { companyId: user.companyId, moduleKey, requestKey };
      const existing = await repo.findOneBy(where);
      if (existing) {
        if (existing.userId !== user.userId)
          throw new ConflictException('다른 사용자의 생성 요청입니다.');
        return existing.documentId;
      }
      const module = findModule(moduleKey);
      if (!module || !('documentPrefix' in module))
        throw new BadRequestException('채번 대상 모듈이 아닙니다.');
      const documentId = await this.next(
        manager,
        user.companyId,
        module.documentPrefix,
        this.yearMonth(),
      );
      await repo.insert({ ...where, documentId, userId: user.userId });
      return documentId;
    });
  }

  async createDocument<T>(
    user: UserContext,
    moduleKey: AppModuleKey,
    requestKey: string,
    create: (id: string) => Promise<T>,
    read: (id: string) => Promise<T>,
    attachmentId?: string | null,
    linkedApproval = false,
    recover?: (id: string) => Promise<T>,
  ): Promise<T> {
    const id = await this.reserve(user, moduleKey, requestKey);
    const where = { companyId: user.companyId, moduleKey, requestKey };
    // 실행 중인 요청은 짧은 DB 트랜잭션으로 선점한다. 문서 서비스 호출 중 DB 연결을 잡아 두지 않는다.
    const completed = await this.db.transaction(async (manager) => {
      await this.lock(
        manager,
        `document-create:${user.companyId}:${moduleKey}:${requestKey}`,
      );
      const repo = manager.getRepository(DocumentRequest);
      const request = await repo.findOneByOrFail(where);
      if (request.processing)
        throw new ConflictException(
          '동일한 문서 저장이 처리 중입니다. 잠시 후 다시 시도하십시오.',
        );
      request.processing = true;
      await repo.save(request);
      return request.completed;
    });
    try {
      let existing: T | undefined;
      try {
        existing = await read(id);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
      let result: T;
      if (existing !== undefined) {
        const savedAttachment = (existing as { attachmentId?: string | null })
          .attachmentId;
        if (!linkedApproval)
          await this.bindAttachment(user, moduleKey, id, savedAttachment);
        result = !completed && recover ? await recover(id) : existing;
      } else {
        result = await this.saveDocument(
          user,
          moduleKey,
          id,
          attachmentId,
          () => create(id),
          linkedApproval,
        );
      }
      await this.db
        .getRepository(DocumentRequest)
        .update(where, { completed: true });
      return result;
    } finally {
      await this.db
        .getRepository(DocumentRequest)
        .update(where, { processing: false });
    }
  }

  async saveDocument<T>(
    user: UserContext,
    moduleKey: AppModuleKey,
    id: string,
    attachmentId: string | null | undefined,
    save: () => Promise<T>,
    linkedApproval = false,
  ): Promise<T> {
    if (!linkedApproval)
      await this.checkAttachment(user, moduleKey, id, attachmentId);
    const result = await save();
    // 앞선 문서 저장은 첨부 연결 실패로 롤백하지 않는다.
    if (!linkedApproval)
      await this.bindAttachment(user, moduleKey, id, attachmentId);
    return result;
  }

  private async checkAttachment(
    user: UserContext,
    moduleKey: AppModuleKey,
    id: string,
    attachmentId?: string | null,
  ) {
    if (!attachmentId) return;
    const row = await this.db
      .getRepository(Attachment)
      .findOneBy({ companyId: user.companyId, attachmentId, deleteYn: 'N' });
    if (
      !row ||
      row.refModule !== moduleKey ||
      (row.refId !== null && row.refId !== id)
    ) {
      throw new BadRequestException(
        '첨부 그룹의 회사·모듈·문서 연결을 확인하십시오.',
      );
    }
  }

  private async bindAttachment(
    user: UserContext,
    moduleKey: AppModuleKey,
    id: string,
    attachmentId?: string | null,
  ) {
    if (!attachmentId) return;
    await this.db.transaction(async (manager) => {
      await this.lock(
        manager,
        `attachment-bind:${user.companyId}:${attachmentId}`,
      );
      const repo = manager.getRepository(Attachment);
      const row = await repo.findOneBy({
        companyId: user.companyId,
        attachmentId,
        deleteYn: 'N',
      });
      if (
        !row ||
        row.refModule !== moduleKey ||
        (row.refId !== null && row.refId !== id)
      ) {
        throw new ConflictException(
          '첨부 그룹을 다른 문서에 연결할 수 없습니다.',
        );
      }
      if (row.refId === id) return;
      row.refId = id;
      row.updatedBy = user.userId;
      row.updatedAt = new Date();
      await repo.save(row);
    });
  }
}
