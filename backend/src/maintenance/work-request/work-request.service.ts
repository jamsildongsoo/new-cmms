import { businessDate } from '../../common/utils/date.util';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import {
  PermissionAction,
  buildPermissionCode,
} from '../../common/constants/permissions';

import { ModuleCode } from '../../common/constants/modules';
import type { EntityManager } from 'typeorm';
/** 회사·문서 범위의 작업의뢰를 관리하고 작성자 초안 변경과 결재 상태 연계를 처리한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { DocumentStatus } from '../../common/constants/document-status';
import { assertDraft } from '../../common/utils/document-status.util';
import { Equipment } from '../equipment/entities/equipment.entity';
import { WorkOrder } from '../work-order/entities/work-order.entity';
import { WorkRequest } from './entities/work-request.entity';
import { CreateWorkRequestDto } from './dto/create-work-request.dto';
import { UpdateWorkRequestDto } from './dto/update-work-request.dto';
import { SearchWorkRequestDto } from './dto/search-work-request.dto';

@Injectable()
export class WorkRequestService {
  withManager(manager: EntityManager): WorkRequestService {
    return new WorkRequestService(
      manager.getRepository(WorkRequest),
      manager.getRepository(Equipment),
    );
  }

  constructor(
    @InjectRepository(WorkRequest)
    private readonly repository: Repository<WorkRequest>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}
  private scoped(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.createQueryBuilder('wr');
    query
      .where('wr.companyId = :companyId', { companyId: user.companyId })
      .andWhere('wr.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('wr.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `wr.deptId IN (
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
  async findAll(user: UserContext, filter: SearchWorkRequestDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.scoped(user).select([
      'wr.workRequestId',
      'wr.documentNo',
      'wr.title',
      'wr.equipmentId',
      'wr.occurredDate',
      'wr.priorityCode',
      'wr.status',
    ]);
    if (filter.search?.trim())
      query.andWhere(
        '(wr.workRequestId ILIKE :search OR wr.documentNo ILIKE :search OR wr.title ILIKE :search OR wr.equipmentId ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [rows, total] = await query
      .orderBy('wr.createdAt', 'DESC')
      .addOrderBy('wr.workRequestId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: rows.map(
        ({
          workRequestId,
          documentNo,
          title,
          equipmentId,
          occurredDate,
          priorityCode,
          status,
        }) => ({
          workRequestId,
          documentNo,
          title,
          equipmentId,
          occurredDate,
          priorityCode,
          status,
        }),
      ),
      total,
      page,
      limit,
    };
  }
  async findOne(user: UserContext, id: string) {
    const row = await this.scoped(user)
      .andWhere('wr.workRequestId = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('Work request not found');
    return row;
  }
  async listForPlan(user: UserContext) {
    if (
      !user.permissions?.includes(
        buildPermissionCode(ModuleCode.WRKREQ, PermissionAction.READ),
      )
    )
      return [];
    return this.scoped(user)
      .andWhere('wr.status = :status', { status: DocumentStatus.CONFIRMED })
      .select(['wr.workRequestId', 'wr.documentNo', 'wr.title', 'wr.status'])
      .orderBy('wr.createdAt', 'DESC')
      .getMany();
  }
  async findForPlan(user: UserContext, id: string) {
    if (
      !user.permissions?.includes(
        buildPermissionCode(ModuleCode.WRKREQ, PermissionAction.READ),
      )
    )
      throw new ForbiddenException('Work request read permission is required');
    const request = await this.findOne(user, id);
    if (request.status !== DocumentStatus.CONFIRMED)
      throw new ConflictException(
        'Only confirmed work requests can be referenced',
      );
    return request;
  }
  async getOptions(user: UserContext) {
    this.scoped(user);
    // frontend/src/modules/maintenance/work-request/priority.ts의 상·중·하는 참고값이다.
    // 우선순위 목록은 프런트에서 관리하고 백엔드에서 공통코드 검증하지 않는다.
    const equipment = await this.equipmentRepository.find({
      where: { companyId: user.companyId, deleteYn: 'N' },
      order: { equipmentId: 'ASC' },
    });
    return {
      equipment: equipment.map(({ equipmentId, name }) => ({
        value: equipmentId,
        label: name,
      })),
      siteId: user.siteId ?? null,
      deptId: user.deptId || null,
    };
  }
  private relatedPlanQuery(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.manager
      .getRepository(WorkOrder)
      .createQueryBuilder('wo');
    query
      .where('wo.companyId = :companyId', { companyId: user.companyId })
      .andWhere('wo.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('wo.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `wo.deptId IN (
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

  /** 작업요청 접근과 작업오더 조회 권한·범위를 각각 확인한 뒤 연결 계획을 반환한다. */
  async relatedPlans(user: UserContext, id: string) {
    await this.findOne(user, id);
    if (
      !user.permissions?.includes(
        buildPermissionCode(ModuleCode.WRKORD, PermissionAction.READ),
      )
    )
      return [];
    const query = this.relatedPlanQuery(user);
    return query
      .andWhere('wo.orderKind = :kind', { kind: 'PLAN' })
      .andWhere('wo.refModule = :module AND wo.refId = :id', {
        module: ModuleCode.WRKREQ,
        id,
      })
      .select([
        'wo.workOrderId',
        'wo.documentNo',
        'wo.title',
        'wo.status',
        'wo.workDate',
      ])
      .orderBy('wo.createdAt', 'DESC')
      .getMany();
  }
  async create(user: UserContext, dto: CreateWorkRequestDto) {
    if (
      await this.repository.findOneBy({
        companyId: user.companyId,
        workRequestId: dto.workRequestId,
      })
    )
      throw new ConflictException('Work request already exists');
    await this.checkEquipment(user.companyId, dto.equipmentId);
    return this.repository.save(
      this.repository.create({
        companyId: user.companyId,
        workRequestId: dto.workRequestId,
        documentNo: dto.documentNo?.trim() ?? '',
        title: this.required(dto.title, 'title'),
        equipmentId: this.required(dto.equipmentId, 'equipmentId'),
        occurredDate: this.date(dto.occurredDate),
        content: this.required(dto.content, 'content'),
        priorityCode: dto.priorityCode?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        note: dto.note?.trim() || null,
        requesterId: user.userId,
        siteId: user.siteId ?? null,
        deptId: user.deptId || null,
        status: DocumentStatus.DRAFT,
        deleteYn: 'N',
        createdBy: user.userId,
      }),
    );
  }
  async update(user: UserContext, id: string, dto: UpdateWorkRequestDto) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    if (dto.equipmentId !== undefined) {
      await this.checkEquipment(user.companyId, dto.equipmentId);
      row.equipmentId = this.required(dto.equipmentId, 'equipmentId');
    }
    if (dto.title !== undefined) row.title = this.required(dto.title, 'title');
    if (dto.content !== undefined)
      row.content = this.required(dto.content, 'content');
    if (dto.occurredDate !== undefined)
      row.occurredDate = this.date(dto.occurredDate);
    if (dto.documentNo !== undefined)
      row.documentNo = dto.documentNo?.trim() ?? '';
    if (dto.priorityCode !== undefined)
      row.priorityCode = dto.priorityCode?.trim() || null;
    if (dto.note !== undefined) row.note = dto.note?.trim() || null;
    if (dto.attachmentId !== undefined)
      row.attachmentId = dto.attachmentId?.trim() || null;
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    row.deleteYn = 'Y';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.repository.save(row);
  }
  async assertCanSubmit(user: UserContext, id: string) {
    this.editable(user, await this.findOne(user, id));
  }
  async syncApprovalStatus(
    companyId: string,
    id: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const row = await this.repository.findOneBy({
      companyId,
      workRequestId: id,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('Work request not found');
    row.status = status;
    row.updatedBy = updatedBy;
    row.updatedAt = new Date();
    await this.repository.save(row);
  }
  private editable(user: UserContext, row: WorkRequest) {
    assertDraft(row.status);
    if (row.createdBy !== user.userId)
      throw new ForbiddenException('Only the owner can change this document');
  }
  private required(value: string | undefined, field: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
  private async checkEquipment(companyId: string, id: string) {
    if (
      !(await this.equipmentRepository.findOneBy({
        companyId,
        equipmentId: this.required(id, 'equipmentId'),
        deleteYn: 'N',
      }))
    )
      throw new NotFoundException('Equipment not found');
  }
  private date(value: string): string {
    return businessDate(
      this.required(value, 'occurredDate'),
      false,
      'occurredDate',
    )!;
  }
}
