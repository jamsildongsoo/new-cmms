import { businessDate } from '../../common/utils/date.util';
import { inputQuantity, inputPrice } from '../../common/utils/decimal.util';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { ModuleCode } from '../../common/constants/modules';
import type { EntityManager } from 'typeorm';
/** 계획/실적 WO와 선택 원본 참조를 관리하며 회사·문서 범위·작성자·초안 상태를 검사한다. */
import { WorkRequestService } from '../work-request/work-request.service';
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
import { CodeGroup } from '../../common/constants/code';
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
  withManager(manager: EntityManager): WorkOrderService {
    return new WorkOrderService(
      manager.getRepository(WorkOrder),
      manager.getRepository(Equipment),
      this.workRequestService.withManager(manager),
    );
  }

  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    private readonly workRequestService: WorkRequestService,
  ) {}

  /** 회사 조건을 먼저 고정하고 모든 일반 조회·변경에 같은 문서 범위를 사용한다. */
  private scopedQuery(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.createQueryBuilder('wo');
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

  async findAll(user: UserContext, filter: SearchWorkOrderDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.scopedQuery(user).select([
      'wo.workOrderId',
      'wo.documentNo',
      'wo.title',
      'wo.orderKind',
      'wo.equipmentId',
      'wo.workDate',
      'wo.status',
      'wo.laborItems',
      'wo.materials',
      'wo.costItems',
    ]);
    if (filter.search?.trim())
      query.andWhere(
        '(wo.workOrderId ILIKE :search OR wo.documentNo ILIKE :search OR wo.title ILIKE :search OR wo.equipmentId ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [rows, total] = await query
      .orderBy('wo.createdAt', 'DESC')
      .addOrderBy('wo.workOrderId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return {
      items: rows.map((row) => {
        const {
          workOrderId,
          documentNo,
          title,
          orderKind,
          equipmentId,
          workDate,
          totalCost,
          status,
        } = this.response(row);
        return {
          workOrderId,
          documentNo,
          title,
          orderKind,
          equipmentId,
          workDate,
          totalCost,
          status,
        };
      }),
      total,
      page,
      limit,
    };
  }
  async findOne(user: UserContext, id: string) {
    return this.response(await this.findAccessible(user, id));
  }

  async getOptions(user: UserContext) {
    const plansQuery = this.scopedQuery(user)
      .andWhere('wo.orderKind = :kind', {
        kind: 'PLAN',
      })
      .andWhere('wo.status = :planStatus', {
        planStatus: DocumentStatus.CONFIRMED,
      });
    const [equipment, types, plans, requests] = await Promise.all([
      this.equipmentRepository.find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { equipmentId: 'ASC' },
      }),
      this.repository.manager.getRepository(CodeItem).find({
        where: { companyId: user.companyId, codeId: CodeGroup.WRKORD_TYPE },
        order: { sortOrder: 'ASC', codeItemId: 'ASC' },
      }),
      plansQuery
        .select(['wo.workOrderId', 'wo.documentNo', 'wo.title', 'wo.status'])
        .orderBy('wo.createdAt', 'DESC')
        .getMany(),
      this.workRequestService.listForPlan(user),
    ]);
    const units = await this.repository.manager.getRepository(CodeItem).find({
      where: { companyId: user.companyId, codeId: CodeGroup.UNIT },
      order: { sortOrder: 'ASC', codeItemId: 'ASC' },
    });
    return {
      // 프런트의 해당 업무 Options.units와 함께 수정한다. UNIT 항목은 DB에서 조회한다.
      units: units.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
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
    const normalized = this.details(
      {
        laborItems: dto.laborItems ?? document.laborItems,
        materials: dto.materials ?? document.materials,
        costItems: dto.costItems ?? document.costItems,
      },
      document.materials,
    );
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
    const document = await this.findAccessible(user, id);
    this.assertEditable(user, document);
    await this.checkReference(
      user,
      document.orderKind,
      document.refModule,
      document.refId,
    );
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
  /** 계획은 작업요청, 실적은 완결된 작업계획만 참조한다. 연결만으로 원문이나 재고를 갱신하지 않는다. */
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
      if (refModule !== ModuleCode.WRKREQ)
        throw new BadRequestException('Plans can only reference work requests');
      await this.workRequestService.findForPlan(user, refId);
    } else {
      if (refModule !== ModuleCode.WRKORD)
        throw new BadRequestException(
          'Actual work can only reference work order plans',
        );
      const plan = await this.findAccessible(user, refId);
      if (plan.orderKind !== 'PLAN')
        throw new BadRequestException('Referenced document must be a plan');
      if (plan.status !== DocumentStatus.CONFIRMED)
        throw new ConflictException('완결된 작업계획만 참조할 수 있습니다.');
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
    return businessDate(this.required(value, 'workDate'), false, 'workDate')!;
  }
  /** 자재·공수·비용은 작업 기록이다. 공통 헬퍼는 변환·자릿수 검사만 담당하고 업무 금액은 여기서 결정한다. */
  private details(
    dto: Pick<CreateWorkOrderDto, 'laborItems' | 'materials' | 'costItems'>,
    existingMaterials: MaterialItem[] = [],
  ) {
    const laborItems: LaborItem[] = (dto.laborItems ?? []).map((row) => ({
      workerName: this.required(row.workerName, 'workerName'),
      content: row.content?.trim() ?? '',
      hours: nonNegative(row.hours, 'hours'),
    }));
    const materials: MaterialItem[] = (dto.materials ?? []).map(
      (row, index) => {
        const old = existingMaterials[index];
        const sameMaterial =
          old &&
          old.name === row.name &&
          old.spec === (row.spec?.trim() ?? '') &&
          old.unit === (row.unit?.trim() ?? '');
        inputQuantity(
          String(row.quantity),
          false,
          sameMaterial ? String(old.quantity) : undefined,
        );
        // 기존 JSON의 소수 단가를 그대로 저장하는 경우만 보존한다.
        if (!sameMaterial || old.unitPrice !== row.unitPrice)
          inputPrice(String(row.unitPrice));
        return {
          name: this.required(row.name, 'material name'),
          spec: row.spec?.trim() ?? '',
          unit: row.unit?.trim() ?? '',
          quantity: nonNegative(row.quantity, 'quantity'),
          unitPrice: nonNegative(row.unitPrice, 'unitPrice', 2),
          amount: materialAmount(row.quantity, row.unitPrice),
        };
      },
    );
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
