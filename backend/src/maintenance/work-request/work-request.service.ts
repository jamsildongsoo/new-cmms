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
import { Code } from '../../common/constants/code';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { DocumentStatus } from '../../common/constants/document-status';
import { assertDraft } from '../../common/utils/document-status.util';
import { applyDocumentScope } from '../../common/utils/document-scope.util';
import { Equipment } from '../equipment/entities/equipment.entity';
import { WorkOrder } from '../work-order/entities/work-order.entity';
import { WorkRequest } from './entities/work-request.entity';
import { CreateWorkRequestDto } from './dto/create-work-request.dto';
import { UpdateWorkRequestDto } from './dto/update-work-request.dto';
import { SearchWorkRequestDto } from './dto/search-work-request.dto';

@Injectable()
export class WorkRequestService {
  constructor(
    @InjectRepository(WorkRequest)
    private readonly repository: Repository<WorkRequest>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}
  private scoped(user: UserContext) {
    return applyDocumentScope(
      this.repository.createQueryBuilder('wr'),
      user,
      'wr',
    );
  }
  async findAll(user: UserContext, search: SearchWorkRequestDto = {}) {
    const query = this.scoped(user);
    if (search.status)
      query.andWhere('wr.status = :status', { status: search.status });
    if (search.priorityCode)
      query.andWhere('wr.priorityCode = :priority', {
        priority: search.priorityCode,
      });
    if (search.searchVal?.trim()) {
      if (
        !['title', 'documentNo', 'equipmentId'].includes(
          search.searchType ?? '',
        )
      )
        throw new BadRequestException('Invalid searchType');
      query.andWhere(`wr.${search.searchType} ILIKE :searchVal`, {
        searchVal: `%${search.searchVal.trim().replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    if (search.occurredDateFrom)
      query.andWhere('wr.occurredDate >= :dateFrom', {
        dateFrom: this.date(search.occurredDateFrom),
      });
    if (search.occurredDateTo)
      query.andWhere('wr.occurredDate <= :dateTo', {
        dateTo: this.date(search.occurredDateTo),
      });
    if (
      search.occurredDateFrom &&
      search.occurredDateTo &&
      search.occurredDateFrom > search.occurredDateTo
    )
      throw new BadRequestException('Invalid date range');
    return query.orderBy('wr.createdAt', 'DESC').getMany();
  }
  async findOne(user: UserContext, id: string) {
    const row = await this.scoped(user)
      .andWhere('wr.workRequestId = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('Work request not found');
    return row;
  }
  async listForPlan(user: UserContext) {
    if (!user.permissions?.includes('work_request:read')) return [];
    return this.scoped(user)
      .andWhere('wr.status = :status', { status: 'C' })
      .select(['wr.workRequestId', 'wr.documentNo', 'wr.title', 'wr.status'])
      .orderBy('wr.createdAt', 'DESC')
      .getMany();
  }
  async findForPlan(user: UserContext, id: string) {
    if (!user.permissions?.includes('work_request:read'))
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
    const [equipment, priorities] = await Promise.all([
      this.equipmentRepository.find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { equipmentId: 'ASC' },
      }),
      this.repository.manager.getRepository(CodeItem).find({
        where: {
          companyId: user.companyId,
          codeId: Code.WORK_REQUEST_PRIORITY,
        },
        order: { sortOrder: 'ASC', codeItemId: 'ASC' },
      }),
    ]);
    return {
      equipment: equipment.map(({ equipmentId, name }) => ({
        value: equipmentId,
        label: name,
      })),
      priorities: priorities.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
      siteId: user.siteId ?? null,
      deptId: user.deptId || null,
    };
  }
  async relatedPlans(user: UserContext, id: string) {
    await this.findOne(user, id);
    if (!user.permissions?.includes('work_order:read')) return [];
    const query = applyDocumentScope(
      this.repository.manager.getRepository(WorkOrder).createQueryBuilder('wo'),
      user,
      'wo',
    );
    return query
      .andWhere('wo.orderKind = :kind', { kind: 'PLAN' })
      .andWhere('wo.refModule = :module AND wo.refId = :id', {
        module: 'work_request',
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
    this.scoped(user);
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
        status: 'D',
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
  private date(value: string) {
    const raw = this.required(value, 'occurredDate');
    if (!/^\d{8}$/.test(raw))
      throw new BadRequestException('occurredDate must be YYYYMMDD');
    const date = new Date(
      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`,
    );
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10).replaceAll('-', '') !== raw
    )
      throw new BadRequestException('occurredDate must be a valid date');
    return raw;
  }
}
