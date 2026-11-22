/** 회사·모듈·발급월별 문서 채번, 저장 후 첨부 연결을 공통 처리한다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ModuleCode, findModule } from '../common/constants/modules';
import type { UserContext } from '../auth/types/user-context.type';
import { Attachment } from '../attachments/entities/attachment.entity';
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
    moduleCode: ModuleCode,
    date = new Date(),
  ): Promise<string> {
    if (!findModule(moduleCode))
      throw new BadRequestException('등록되지 않은 업무 모듈입니다.');
    const yyyymm = this.yearMonth(date);
    return this.db.transaction((manager) =>
      this.next(manager, companyId, moduleCode, yyyymm),
    );
  }

  private async next(
    manager: EntityManager,
    companyId: string,
    moduleCode: ModuleCode,
    yyyymm: string,
  ) {
    await this.lock(
      manager,
      `document-number:${companyId}:${moduleCode}:${yyyymm}`,
    );
    const repo = manager.getRepository(NumberSequence);
    const where = { companyId, moduleCode, yyyymm };
    const row =
      (await repo.findOneBy(where)) ?? repo.create({ ...where, lastSerial: 0 });
    if (row.lastSerial >= 99999)
      throw new ConflictException('월별 문서번호 발급 한도를 초과했습니다.');
    row.lastSerial += 1;
    await repo.save(row);
    return `${moduleCode}-${yyyymm}-${String(row.lastSerial).padStart(5, '0')}`;
  }

  /** 채번은 먼저 확정한다. 저장 실패 번호는 재사용하지 않으며, 재요청은 새 문서를 생성한다.
   * frontend/src/modules 각 생성 API는 요청 키 없이 POST한다. 동작 변경 시 양쪽을 함께 수정한다.
   */
  async createDocument<T>(
    user: UserContext,
    moduleCode: ModuleCode,
    create: (id: string) => Promise<T>,
    attachmentId?: string | null,
    linkedApproval = false,
  ): Promise<T> {
    const id = await this.generateDocumentId(user.companyId, moduleCode);
    return this.saveDocument(
      user,
      moduleCode,
      id,
      attachmentId,
      () => create(id),
      linkedApproval,
    );
  }

  async saveDocument<T>(
    user: UserContext,
    moduleCode: ModuleCode,
    id: string,
    attachmentId: string | null | undefined,
    save: () => Promise<T>,
    linkedApproval = false,
  ): Promise<T> {
    if (!linkedApproval)
      await this.checkAttachment(user, moduleCode, id, attachmentId);
    const result = await save();
    // 앞선 문서 저장은 첨부 연결 실패로 롤백하지 않는다.
    if (!linkedApproval)
      await this.bindAttachment(user, moduleCode, id, attachmentId);
    return result;
  }

  private async checkAttachment(
    user: UserContext,
    moduleCode: ModuleCode,
    id: string,
    attachmentId?: string | null,
  ) {
    if (!attachmentId) return;
    const row = await this.db
      .getRepository(Attachment)
      .findOneBy({ companyId: user.companyId, attachmentId, deleteYn: 'N' });
    if (
      !row ||
      row.refModule !== moduleCode ||
      (row.refId !== null && row.refId !== id)
    ) {
      throw new BadRequestException(
        '첨부 그룹의 회사·모듈·문서 연결을 확인하십시오.',
      );
    }
  }

  private async bindAttachment(
    user: UserContext,
    moduleCode: ModuleCode,
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
        row.refModule !== moduleCode ||
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
