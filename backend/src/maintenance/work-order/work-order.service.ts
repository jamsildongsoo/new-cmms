/** 계획/실적 WO와 선택 원본 참조를 관리하며 회사·문서 범위·작성자·초안 상태를 검사한다. */
import { WorkRequestService } from '../work-request/work-request.service';
import { applyDocumentScope } from '../../common/utils/document-scope.util';
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
import { Code } from '../../common/constants/code';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { SearchWorkOrderDto } from './dto/search-work-order.dto';
import {
  WorkOrder,
  LaborItem,
  MaterialItem,
  CostItem,
} from './entities/work-order.entity';
import {
  materialAmount,
  nonNegative,
  workOrderTotals,
} from './work-order-totals';

@Injectable()
export class WorkOrderService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    private readonly workRequestService: WorkRequestService,
  ) {}

  /** 회사 조건을 먼저 고정하고 모든 일반 조회·변경에 같은 문서 범위를 사용한다. */
  private scopedQuery(user: UserContext) {
    return applyDocumentScope(
      this.repository.createQueryBuilder('wo'),
      user,
      'wo',
    );
  }

  async findAll(user: UserContext, search: SearchWorkOrderDto = {}) {
    const query = this.scopedQuery(user);
    if (search.orderKind)
      query.andWhere('wo.orderKind = :orderKind', {
        orderKind: search.orderKind,
      });
    if (search.status)
      query.andWhere('wo.status = :status', { status: search.status });
    if (search.searchVal?.trim()) {
      if (
        !['title', 'documentNo', 'equipmentId'].includes(
          search.searchType ?? '',
        )
      )
        throw new BadRequestException('Invalid searchType');
      const value = search.searchVal.trim().replace(/[\\%_]/g, '\\$&');
      query.andWhere(`wo.${search.searchType} ILIKE :searchVal`, {
        searchVal: `%${value}%`,
      });
    }
    if (search.workDateFrom)
      query.andWhere('wo.workDate >= :dateFrom', {
        dateFrom: this.date(search.workDateFrom),
      });
    if (search.workDateTo)
      query.andWhere('wo.workDate <= :dateTo', {
        dateTo: this.date(search.workDateTo),
      });
    if (
      search.workDateFrom &&
      search.workDateTo &&
      search.workDateFrom > search.workDateTo
    )
      throw new BadRequestException('Invalid work date range');
    return (await query.orderBy('wo.createdAt', 'DESC').getMany()).map((row) =>
      this.response(row),
    );
  }

  async findOne(user: UserContext, id: string) {
    return this.response(await this.findAccessible(user, id));
  }

  async getOptions(user: UserContext) {
    const plansQuery = this.scopedQuery(user).andWhere('wo.orderKind = :kind', {
      kind: 'PLAN',
    });
    const [equipment, types, plans, requests] = await Promise.all([
      this.equipmentRepository.find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { equipmentId: 'ASC' },
      }),
      this.repository.manager.getRepository(CodeItem).find({
        where: { companyId: user.companyId, codeId: Code.WORK_ORDER_TYPE },
        order: { sortOrder: 'ASC', codeItemId: 'ASC' },
      }),
      plansQuery
        .select(['wo.workOrderId', 'wo.documentNo', 'wo.title', 'wo.status'])
        .orderBy('wo.createdAt', 'DESC')
        .getMany(),
      this.workRequestService.listForPlan(user),
    ]);
    return {
      equipment: equipment.map(({ equipmentId, name }) => ({
        value: equipmentId,
        label: name,
      })),
      types: types.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
      plans: plans.map(({ workOrderId, documentNo, title, status }) => ({
        workOrderId,
        documentNo,
        title,
        status,
      })),
      requests: requests.map(
        ({ workRequestId, documentNo, title, status }) => ({
          workRequestId,
          documentNo,
          title,
          status,
        }),
      ),
      siteId: user.siteId ?? null,
      deptId: user.deptId || null,
    };
  }

  async create(user: UserContext, dto: CreateWorkOrderDto) {
    // 소속이 없는 제한 범위 사용자의 생성도 조회와 동일하게 거부한다.
    this.scopedQuery(user);
    if (
      await this.repository.findOneBy({
        companyId: user.companyId,
        workOrderId: dto.workOrderId,
      })
    )
      throw new ConflictException('Work order already exists');
    if (dto.orderKind !== 'PLAN' && dto.orderKind !== 'ACTUAL')
      throw new BadRequestException('Invalid orderKind');
    const refModule = this.nullable(dto.refModule);
    const refId = this.nullable(dto.refId);
    await this.checkReference(user, dto.orderKind, refModule, refId);
    await this.checkEquipment(user.companyId, dto.equipmentId);
    const document = this.repository.create({
      companyId: user.companyId,
      workOrderId: dto.workOrderId,
      orderKind: dto.orderKind,
      refModule,
      refId,
      siteId: user.siteId ?? null,
      deptId: user.deptId || null,
      documentNo: dto.documentNo?.trim() ?? '',
      title: this.required(dto.title, 'title'),
      equipmentId: this.required(dto.equipmentId, 'equipmentId'),
      workDate: this.date(dto.workDate),
      typeCode: this.nullable(dto.typeCode),
      content: this.nullable(dto.content),
      note: this.nullable(dto.note),
      attachmentId: this.nullable(dto.attachmentId),
      ...this.details(dto),
      requesterId: user.userId,
      status: DocumentStatus.DRAFT,
      deleteYn: 'N',
      createdBy: user.userId,
    });
    this.response(document); // 합계 범위 오류도 저장 전에 확인한다.
    return this.response(await this.repository.save(document));
  }

  async update(user: UserContext, id: string, dto: UpdateWorkOrderDto) {
    const document = await this.findAccessible(user, id);
    this.assertEditable(user, document);
    if (dto.refModule !== undefined || dto.refId !== undefined) {
      const refModule =
        dto.refModule === undefined
          ? document.refModule
          : this.nullable(dto.refModule);
      const refId =
        dto.refId === undefined ? document.refId : this.nullable(dto.refId);
      if (refModule !== document.refModule || refId !== document.refId) {
        await this.checkReference(user, document.orderKind, refModule, refId);
        document.refModule = refModule;
        document.refId = refId;
      }
    }
    if (dto.equipmentId !== undefined) {
      await this.checkEquipment(user.companyId, dto.equipmentId);
      document.equipmentId = this.required(dto.equipmentId, 'equipmentId');
    }
    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo?.trim() ?? '';
    if (dto.title !== undefined)
      document.title = this.required(dto.title, 'title');
    if (dto.workDate !== undefined) document.workDate = this.date(dto.workDate);
    if (dto.typeCode !== undefined)
      document.typeCode = this.nullable(dto.typeCode);
    if (dto.content !== undefined)
      document.content = this.nullable(dto.content);
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = this.nullable(dto.note);
    const normalized = this.details({
      laborItems: dto.laborItems ?? document.laborItems,
      materials: dto.materials ?? document.materials,
      costItems: dto.costItems ?? document.costItems,
    });
    Object.assign(document, normalized, {
      updatedBy: user.userId,
      updatedAt: new Date(),
    });
    this.response(document);
    return this.response(await this.repository.save(document));
  }

  async remove(user: UserContext, id: string) {
    const document = await this.findAccessible(user, id);
    this.assertEditable(user, document);
    document.deleteYn = 'Y';
    document.updatedBy = user.userId;
    document.updatedAt = new Date();
    return this.response(await this.repository.save(document));
  }

  // 결재 API에서 원본을 지정한 경우에도 원본의 owner·D·조회 범위를 먼저 확인한다.
  async assertCanSubmit(user: UserContext, id: string) {
    this.assertEditable(user, await this.findAccessible(user, id));
  }

  /** 결재 결과는 이미 확정됐다. 대상 한 건만 갱신하고 계획·실적·설비·재고에 전파하지 않는다. */
  async syncApprovalStatus(
    companyId: string,
    id: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const document = await this.repository.findOneBy({
      companyId,
      workOrderId: id,
      deleteYn: 'N',
    });
    if (!document) throw new NotFoundException('Work order not found');
    document.status = status;
    document.updatedBy = updatedBy;
    document.updatedAt = new Date();
    await this.repository.save(document);
  }

  private async findAccessible(user: UserContext, id: string) {
    const document = await this.scopedQuery(user)
      .andWhere('wo.workOrderId = :id', { id })
      .getOne();
    if (!document) throw new NotFoundException('Work order not found');
    return document;
  }
  private assertEditable(user: UserContext, document: WorkOrder) {
    assertDraft(document.status);
    if (document.createdBy !== user.userId)
      throw new ForbiddenException('Only the owner can change this document');
  }
  private async checkReference(
    user: UserContext,
    kind: string,
    refModule: string | null,
    refId: string | null,
  ) {
    if (Boolean(refModule) !== Boolean(refId))
      throw new BadRequestException(
        'refModule and refId must be provided together',
      );
    if (!refModule || !refId) return;
    if (kind === 'PLAN') {
      if (refModule !== 'work_request')
        throw new BadRequestException('Plans can only reference work requests');
      await this.workRequestService.findForPlan(user, refId);
    } else {
      if (refModule !== 'work_order')
        throw new BadRequestException(
          'Actual work can only reference work order plans',
        );
      const plan = await this.findAccessible(user, refId);
      if (plan.orderKind !== 'PLAN')
        throw new BadRequestException('Referenced document must be a plan');
    }
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
  private required(value: string | undefined, field: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${field} is required`);
    return value.trim();
  }
  private nullable(value: string | null | undefined) {
    return value?.trim() || null;
  }
  private date(value: string): string {
    const raw = this.required(value, 'workDate');
    if (!/^\d{8}$/.test(raw))
      throw new BadRequestException('workDate must be YYYYMMDD');
    const date = new Date(
      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`,
    );
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10).replaceAll('-', '') !== raw
    )
      throw new BadRequestException('workDate must be a valid date');
    return raw;
  }
  private details(
    dto: Pick<CreateWorkOrderDto, 'laborItems' | 'materials' | 'costItems'>,
  ) {
    const laborItems: LaborItem[] = (dto.laborItems ?? []).map((row) => ({
      workerName: this.required(row.workerName, 'workerName'),
      content: row.content?.trim() ?? '',
      hours: nonNegative(row.hours, 'hours'),
    }));
    const materials: MaterialItem[] = (dto.materials ?? []).map((row) => ({
      name: this.required(row.name, 'material name'),
      spec: row.spec?.trim() ?? '',
      unit: row.unit?.trim() ?? '',
      quantity: nonNegative(row.quantity, 'quantity'),
      unitPrice: nonNegative(row.unitPrice, 'unitPrice', 2),
      amount: materialAmount(row.quantity, row.unitPrice),
    }));
    const costItems: CostItem[] = (dto.costItems ?? []).map((row) => ({
      name: this.required(row.name, 'cost name'),
      amount: nonNegative(row.amount, 'amount', 0),
      note: row.note?.trim() ?? '',
    }));
    return { laborItems, materials, costItems };
  }
  private response(document: WorkOrder) {
    // 응답 합계는 저장된 배열에서 계산하며 Entity 인스턴스 자체에는 추가하지 않는다.
    return Object.assign(
      {},
      document,
      workOrderTotals(
        document.laborItems ?? [],
        document.materials ?? [],
        document.costItems ?? [],
      ),
    );
  }
}
