import { SearchPermitDto } from './dto/search-permit.dto';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { ForbiddenException } from '@nestjs/common';
import { DocumentStatus } from '../../common/constants/document-status';
import { ModuleCode } from '../../common/constants/modules';
import type { EntityManager } from 'typeorm';
/** 일반/보충 허가의 템플릿·필수 서류·발급자/승인자를 검사하고 하나의 결재로 연결한다. */
import { WorkPermitRequest } from '../work-permit-request/entities/work-permit-request.entity';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { User } from '../../identity/users/entities/user.entity';
import { AttachmentItem } from '../../attachments/entities/attachment-item.entity';
import { Approval } from '../../approvals/entities/approval.entity';
import { ApprovalStep } from '../../approvals/entities/approval-step.entity';
import { WorkPermitRequestService } from '../work-permit-request/work-permit-request.service';
import { WorkPermit } from './entities/work-permit.entity';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { UpdateWorkPermitDto } from './dto/update-work-permit.dto';
import { SaveWorkPermitDto } from './dto/permit-data.dto';
import {
  PERMIT_NAMES,
  PERMIT_TEMPLATES,
  REQUIRED_DOCUMENTS,
} from './permit-template';
import { permitOwner, validatePermitData } from './permit-validation';
@Injectable()
export class WorkPermitService {
  withManager(manager: EntityManager): WorkPermitService {
    return new WorkPermitService(
      manager.getRepository(WorkPermit),
      this.requests.withManager(manager),
    );
  }

  constructor(
    @InjectRepository(WorkPermit)
    private readonly repository: Repository<WorkPermit>,
    private readonly requests: WorkPermitRequestService,
  ) {}
  private query(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.createQueryBuilder('p');
    query
      .where('p.companyId = :companyId', { companyId: user.companyId })
      .andWhere('p.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('p.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `p.deptId IN (
        WITH RECURSIVE scope_departments AS (
          SELECT "deptId" FROM "department" WHERE "companyId" = :companyId AND "deptId" = :scopeDeptId AND "deleteYn" = 'N'
          UNION
          SELECT d."deptId" FROM "department" d JOIN scope_departments p ON d."parentDeptId" = p."deptId"
          WHERE d."companyId" = :companyId AND d."deleteYn" = 'N'
        ) SELECT "deptId" FROM scope_departments
      )`,
        { scopeDeptId: user.deptId },
      );
    throw new ForbiddenException(
      'Document access scope or affiliation is missing',
    );
  }
  async findAll(user: UserContext, filter: SearchPermitDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.query(user).select([
      'p.workPermitId',
      'p.documentNo',
      'p.data',
      'p.status',
    ]);
    // 설비번호는 직접 입력 참고값이다. 검색 대상은 문서번호·관리번호·작업명만 둔다.
    if (filter.search?.trim())
      query.andWhere(
        "(p.workPermitId ILIKE :search OR p.documentNo ILIKE :search OR p.data->>'title' ILIKE :search)",
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [rows, total] = await query
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.workPermitId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: rows.map((row) => ({
        workPermitId: row.workPermitId,
        documentNo: row.documentNo,
        title: row.data.title,
        applicantName: row.data.applicantName,
        status: row.status,
      })),
      total,
      page,
      limit,
    };
  }
  async findOne(user: UserContext, id: string) {
    const row = await this.query(user)
      .andWhere('p.workPermitId = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('작업 허가서가 없습니다.');
    const users = await this.repository.manager.getRepository(User).find({
      where: {
        companyId: user.companyId,
        userId: In([row.issuerId, row.approverId]),
        deleteYn: 'N',
      },
      select: { userId: true, name: true },
    });
    return Object.assign({}, row, {
      issuerName:
        users.find((person) => person.userId === row.issuerId)?.name ?? null,
      approverName:
        users.find((person) => person.userId === row.approverId)?.name ?? null,
    });
  }
  async options(user: UserContext) {
    this.query(user);
    const users = await this.repository.manager.getRepository(User).find({
      where: { companyId: user.companyId, deleteYn: 'N' },
      order: { userId: 'ASC' },
    });
    return {
      templates: PERMIT_TEMPLATES,
      names: PERMIT_NAMES,
      documents: REQUIRED_DOCUMENTS,
      users: users.map((u) => ({ value: u.userId, label: u.name })),
    };
  }
  /** 허가기간·허가 유형·담당자 등 작업허가 고유 조건을 검사한다. 특수 시간 형식은 이 모듈에서 관리한다. */
  private async validate(user: UserContext, dto: SaveWorkPermitDto) {
    validatePermitData(dto.data);
    if (Boolean(dto.refModule) !== Boolean(dto.refId))
      throw new BadRequestException('참조 모듈과 ID는 함께 지정해야 합니다.');
    if (dto.refModule) {
      if (dto.refModule !== ModuleCode.PERREQ)
        throw new BadRequestException('허가 요청서만 참조할 수 있습니다.');
      const source = await this.requests.findOne(user, dto.refId!);
      if (source.status !== DocumentStatus.CONFIRMED)
        throw new BadRequestException(
          '신청 완료로 확정된 요청서만 선택할 수 있습니다.',
        );
    }
    if (
      !Array.isArray(dto.permitTypes) ||
      !dto.permitTypes.includes('GENERAL') ||
      new Set(dto.permitTypes).size !== dto.permitTypes.length ||
      dto.permitTypes.some((t) => !PERMIT_NAMES[t])
    )
      throw new BadRequestException(
        '일반 항목은 필수이며 유형을 중복 지정할 수 없습니다.',
      );
    if (
      !Array.isArray(dto.sections) ||
      dto.sections.length !== dto.permitTypes.length ||
      new Set(dto.sections.map((s) => s.type)).size !==
        dto.permitTypes.length ||
      dto.sections.some(
        (s) =>
          !dto.permitTypes.includes(s.type) ||
          s.templateVersion !== 1 ||
          !s.safetyRequirements.trim(),
      )
    )
      throw new BadRequestException(
        '선택한 유형의 안전요구사항을 모두 입력하십시오.',
      );
    for (const section of dto.sections)
      for (const key of [
        'safetyRequirements',
        'specialRequirements',
        'safetyReviewOpinion',
      ] as const)
        if (section[key].split('\n').length > 2)
          throw new BadRequestException('A4 출력: 영역별 최대 두 줄입니다.');
    if (dto.data.summary.split('\n').length > 3)
      throw new BadRequestException('작업개요는 최대 세 줄입니다.');
    if (!dto.issuerId || !dto.approverId || dto.issuerId === dto.approverId)
      throw new BadRequestException(
        '발급자와 승인자는 서로 다른 사용자로 지정하십시오.',
      );
    for (const userId of [dto.issuerId, dto.approverId])
      if (
        !(await this.repository.manager
          .getRepository(User)
          .findOneBy({ companyId: user.companyId, userId, deleteYn: 'N' }))
      )
        throw new BadRequestException('유효한 발급자·승인자를 지정하십시오.');
  }
  async create(user: UserContext, dto: CreateWorkPermitDto) {
    await this.validate(user, dto);
    if (
      await this.repository.findOneBy({
        companyId: user.companyId,
        workPermitId: dto.workPermitId,
      })
    )
      throw new ConflictException('이미 존재합니다.');
    return this.repository.save(
      this.repository.create(
        Object.assign({}, dto, {
          documentNo: dto.documentNo?.trim() ?? '',
          companyId: user.companyId,
          siteId: user.siteId ?? null,
          deptId: user.deptId || null,
          refModule: dto.refModule ?? null,
          refId: dto.refId ?? null,
          attachmentId: dto.attachmentId ?? null,
          approvalId: null,
          status: DocumentStatus.DRAFT,
          deleteYn: 'N',
          createdBy: user.userId,
        }),
      ),
    );
  }
  async update(user: UserContext, id: string, dto: UpdateWorkPermitDto) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    await this.validate(user, dto);
    Object.assign(row, {
      documentNo: dto.documentNo?.trim() ?? '',
      data: dto.data,
      refModule: dto.refModule ?? null,
      refId: dto.refId ?? null,
      permitTypes: dto.permitTypes,
      sections: dto.sections,
      issuerId: dto.issuerId,
      approverId: dto.approverId,
      attachmentId: dto.attachmentId ?? null,
      documentFiles: dto.documentFiles,
      updatedBy: user.userId,
      updatedAt: new Date(),
    });
    return this.repository.save(row);
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    row.deleteYn = 'Y';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
  async approvalDraft(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    permitOwner(user, row);
    await this.validate(user, row);
    const source = row.refId
      ? await this.requests.findOne(user, row.refId)
      : null;
    const groups = [row.attachmentId, source?.attachmentId].filter(Boolean);
    for (const requirement of REQUIRED_DOCUMENTS) {
      const files = row.documentFiles.filter(
        (f) => f.requirementId === requirement.id,
      );
      if (!files.length)
        throw new BadRequestException(`${requirement.name} 첨부가 필요합니다.`);
      for (const f of files) {
        if (
          !groups.includes(f.attachmentId) ||
          !(await this.repository.manager
            .getRepository(AttachmentItem)
            .findOneBy({
              companyId: user.companyId,
              attachmentId: f.attachmentId,
              itemNo: f.itemNo,
            }))
        )
          throw new BadRequestException(
            `${requirement.name}의 실제 파일을 확인하십시오.`,
          );
      }
    }
    const paragraph = (text: string) => ({
      type: 'paragraph',
      content: text ? [{ type: 'text', text }] : [],
    });
    const fields = [
      ['허가번호', row.workPermitId],
      ['관리번호', row.documentNo],
      ['작업명', row.data.title],
      ['작업지역', row.data.location],
      ['설비번호', row.data.equipmentNo ?? ''],
      ['허가기간', `${row.data.startTime} ~ ${row.data.endTime}`],
      ['유형', row.data.workType === 'INTERNAL' ? '자체' : '외주'],
      ['작업개요', row.data.summary],
      ...row.sections.flatMap((s) => [
        [`${PERMIT_NAMES[s.type]} 안전조치요구사항`, s.safetyRequirements],
        [`${PERMIT_NAMES[s.type]} 특별요구사항`, s.specialRequirements],
        [`${PERMIT_NAMES[s.type]} 안전검토의견`, s.safetyReviewOpinion],
      ]),
    ];
    return {
      refModule: ModuleCode.PERMIT,
      refId: id,
      title: `[작업허가] ${row.data.title}`,
      attachmentId: row.attachmentId,
      sourceAttachmentIds:
        source?.attachmentId && source.attachmentId !== row.attachmentId
          ? [source.attachmentId]
          : [],
      contentJson: {
        type: 'doc',
        content: fields.map(([k, v]) => paragraph(`${k}: ${v}`)),
      },
    };
  }
  async syncApprovalStatus(
    companyId: string,
    id: string,
    status: WorkPermit['status'],
    updatedBy: string,
    approvalId: string,
  ) {
    const row = await this.repository.findOneBy({
      companyId,
      workPermitId: id,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('작업 허가서가 없습니다.');
    row.status = status;
    row.approvalId = approvalId;
    row.updatedBy = updatedBy;
    row.updatedAt = new Date();
    await this.repository.save(row);
  }
  async relatedAttachmentIds(companyId: string, id: string) {
    const permit = await this.repository.findOneBy({
      companyId,
      workPermitId: id,
      deleteYn: 'N',
    });
    if (!permit?.refId) return [];
    const source = await this.repository.manager
      .getRepository(WorkPermitRequest)
      .findOneBy({
        companyId,
        workPermitRequestId: permit.refId,
        deleteYn: 'N',
      });
    return source?.attachmentId && source.attachmentId !== permit.attachmentId
      ? [source.attachmentId]
      : [];
  }
  async printData(user: UserContext, id: string) {
    const permit = await this.findOne(user, id);
    if (permit.status !== DocumentStatus.CONFIRMED)
      return { permit, approvals: [] };
    const approval = await this.repository.manager
      .getRepository(Approval)
      .findOneBy({
        companyId: user.companyId,
        approvalId: permit.approvalId!,
        refModule: ModuleCode.PERMIT,
        refId: id,
        status: DocumentStatus.CONFIRMED,
        deleteYn: 'N',
      });
    if (!approval)
      throw new ConflictException('연결 결재 완료를 확인할 수 없습니다.');
    const approvals = await this.repository.manager
      .getRepository(ApprovalStep)
      .find({
        where: {
          companyId: user.companyId,
          approvalId: approval.approvalId,
          type: In(['APPROVER', 'AGREE']),
          status: 'Y',
        },
        order: { stepNo: 'ASC' },
      });
    return { permit, approvals };
  }
}
