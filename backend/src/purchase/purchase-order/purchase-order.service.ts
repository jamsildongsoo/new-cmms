import { inputQuantity, inputPrice } from '../../common/utils/decimal.util';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { ModuleCode } from '../../common/constants/modules';
import { CodeGroup } from '../../common/constants/code';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseRequestService } from '../purchase-request/purchase-request.service';
/** 구매발주의 거래처·금액과 선택적 구매요청 참조를 관리한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { businessDate } from '../../common/utils/date.util';
import { decimal, price, qty, rounded } from '../../common/utils/decimal.util';
import { DocumentStatus } from '../../common/constants/document-status';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Material } from '../../inventory/material/entities/material.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { User } from '../../identity/users/entities/user.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';
import { Vendor } from '../vendor/entities/vendor.entity';
import { PurchaseOrderSaveDto } from './dto/purchase-order.dto';
import { PurchaseSearchDto } from '../common/purchase-search.dto';
type Header = PurchaseOrder & {
  vendor?: Vendor | null;
};
type Item = PurchaseOrderItem;
@Injectable()
export class PurchaseOrderService {
  private transactionManager?: EntityManager;
  withManager(manager: EntityManager): PurchaseOrderService {
    const scoped = new PurchaseOrderService(
      this.db,
      this.requests.withManager(manager),
    );
    scoped.transactionManager = manager;
    return scoped;
  }

  constructor(
    private readonly db: DataSource,
    private readonly requests: PurchaseRequestService,
  ) {}
  create(user: UserContext, dto: CreatePurchaseOrderDto) {
    return this.save(user, dto.orderId, dto, true);
  }
  update(user: UserContext, id: string, dto: PurchaseOrderSaveDto) {
    return this.save(user, id, dto, false);
  }
  private headers(manager = this.transactionManager ?? this.db.manager) {
    return manager.getRepository<Header>(PurchaseOrder);
  }
  private items(manager = this.transactionManager ?? this.db.manager) {
    return manager.getRepository(PurchaseOrderItem);
  }
  private scoped(
    user: UserContext,
    manager = this.transactionManager ?? this.db.manager,
  ) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.headers(manager).createQueryBuilder('p');
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
  async findAll(user: UserContext, filter: PurchaseSearchDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const q = this.scoped(user)
      .select([
        'p.orderId',
        'p.documentNo',
        'p.title',
        'p.orderDate',
        'p.status',
        'p.totalAmount',
      ])
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.orderId', 'DESC');
    if (filter.search?.trim())
      q.andWhere(
        '(p.title ILIKE :search OR p.documentNo ILIKE :search OR p.orderId ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [items, total] = await q.skip(offset).take(limit).getManyAndCount();
    return {
      items: items.map(
        ({ orderId, documentNo, title, orderDate, status, totalAmount }) => ({
          orderId,
          documentNo,
          title,
          orderDate,
          status,
          totalAmount,
        }),
      ),
      total,
      page,
      limit,
    };
  }
  async findOne(
    user: UserContext,
    id: string,
    manager = this.transactionManager ?? this.db.manager,
  ) {
    const query = this.scoped(user, manager);
    query.leftJoinAndMapOne(
      'p.vendor',
      Vendor,
      'vendor',
      "vendor.companyId = p.companyId AND vendor.vendorId = p.vendorId AND vendor.deleteYn = 'N'",
    );
    const row = await query.andWhere('p.orderId = :id', { id }).getOne();
    if (!row)
      throw new NotFoundException('구매 문서가 없거나 조회 범위 밖입니다.');
    const items = await this.items(manager).find({
      where: { companyId: user.companyId, orderId: id },
      order: { sortOrder: 'ASC' },
    });
    return Object.assign({}, row, { items });
  }
  private editable(user: UserContext, row: Header) {
    if (row.status !== DocumentStatus.DRAFT || row.createdBy !== user.userId)
      throw new ForbiddenException('작성자만 초안을 처리할 수 있습니다.');
  }
  private text(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${label}을 입력하십시오.`);
    return value.trim();
  }
  /** 원문 조회 범위와 완결 상태를 재확인한다. 프론트가 보낸 참조 ID만으로 원문을 신뢰하지 않는다. */
  private async requestSource(
    user: UserContext,
    id: string,
    manager = this.transactionManager ?? this.db.manager,
  ) {
    const source = await this.requests.findOne(user, id, manager);
    if (source.status !== DocumentStatus.CONFIRMED)
      throw new BadRequestException('완결(C) 구매요청만 선택하십시오.');
    return source;
  }
  async linkedOrders(user: UserContext, requestId: string) {
    await this.requests.findOne(user, requestId);
    return this.scoped(user)
      .select([
        'p.orderId',
        'p.documentNo',
        'p.title',
        'p.status',
        'p.createdAt',
      ])
      .andWhere('p.refModule = :module AND p.refId = :requestId', {
        module: ModuleCode.PURREQ,
        requestId,
      })
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.orderId', 'DESC')
      .getMany();
  }
  async preview(user: UserContext, requestId: string) {
    const source = await this.requestSource(user, requestId);
    // 최초 복사용 데이터이다. 이후 저장·상신 시 원 요청의 품목·수량과 비교하지 않는다.
    // 프런트 purchase-order.api.ts / PurchaseOrderForm.tsx와 함께 수정한다.
    return {
      title: source.title,
      content: source.content,
      note: source.note,
      expectedDeliveryDate: source.requiredDate,
      items: source.items.map((i) => ({
        itemId: randomUUID(),
        materialId: i.materialId,
        materialName: i.materialName,
        spec: i.spec,
        baseUnit: i.baseUnit,
        quantity: i.quantity,
        note: i.note,
        unitPrice: null,
        amount: null,
      })),
    };
  }
  async options(user: UserContext) {
    this.scoped(user);
    const companyId = user.companyId;
    const [materials, sites, departments, users, types] = await Promise.all([
      (this.transactionManager ?? this.db).getRepository(Material).find({
        where: { companyId, deleteYn: 'N' },
        order: { materialId: 'ASC' },
      }),
      (this.transactionManager ?? this.db)
        .getRepository(Site)
        .find({ where: { companyId, deleteYn: 'N' } }),
      (this.transactionManager ?? this.db)
        .getRepository(Department)
        .find({ where: { companyId, deleteYn: 'N' } }),
      (this.transactionManager ?? this.db)
        .getRepository(User)
        .find({ where: { companyId, deleteYn: 'N' } }),
      (this.transactionManager ?? this.db).getRepository(CodeItem).find({
        where: { companyId, codeId: CodeGroup.PURORD_TYPE },
        order: { sortOrder: 'ASC' },
      }),
    ]);
    const options = {
      materials: materials.map(({ materialId, name, spec, baseUnit }) => ({
        materialId,
        name,
        spec,
        baseUnit,
      })),
      sites: sites.map((r) => ({ value: r.siteId, label: r.name })),
      departments: departments.map((r) => ({ value: r.deptId, label: r.name })),
      users: users.map((r) => ({ value: r.userId, label: r.name })),
      types: types.map((r) => ({ value: r.codeItemId, label: r.name })),
    };
    const [requests, vendors] = await Promise.all([
      this.requests.listForReference(user),
      (this.transactionManager ?? this.db).getRepository(Vendor).find({
        where: { companyId, deleteYn: 'N' },
        order: { vendorId: 'ASC' },
      }),
    ]);
    return {
      ...options,
      requests: requests.map(({ requestId, documentNo, title }) => ({
        requestId,
        documentNo,
        title,
      })),
      vendors: vendors.map(
        ({
          vendorId,
          name,
          registrationNumber,
          contactName,
          phoneNumber,
          email,
        }) => ({
          vendorId,
          name,
          registrationNumber,
          contactName,
          phoneNumber,
          email,
        }),
      ),
    };
  }
  /** 발주는 요청의 최초 복사 이후 독립 편집한다. 원문 접근·품목 검증·금액 계산 후 헤더와 품목을 함께 저장한다. */
  async save(
    user: UserContext,
    id: string,
    dto: PurchaseOrderSaveDto,
    create: boolean,
  ) {
    await (this.transactionManager ?? this.db).transaction(async (manager) => {
      let old: Awaited<ReturnType<PurchaseOrderService['findOne']>> | null =
        null;
      if (!create) {
        old = await this.findOne(user, id, manager);
        this.editable(user, old);
      } else if (
        await this.headers(manager).findOneBy({
          companyId: user.companyId,
          orderId: id,
        })
      )
        throw new ConflictException('이미 존재하는 문서입니다.');
      const siteId = dto.siteId ?? old?.siteId ?? user.siteId,
        deptId = dto.deptId ?? old?.deptId ?? user.deptId;
      if (
        dto.typeCode &&
        (!old || dto.typeCode !== old.typeCode) &&
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId: CodeGroup.PURORD_TYPE,
          codeItemId: dto.typeCode,
        }))
      )
        throw new BadRequestException('유형 코드가 없습니다.');
      const refModule =
        dto.refModule === undefined
          ? (old?.refModule ?? null)
          : dto.refModule?.trim() || null;
      const refId =
        dto.refId === undefined
          ? (old?.refId ?? null)
          : dto.refId?.trim() || null;
      if (
        Boolean(refModule) !== Boolean(refId) ||
        (refModule && refModule !== ModuleCode.PURREQ)
      )
        throw new BadRequestException(
          '구매요청 참조 유형과 문서번호를 함께 지정하십시오.',
        );
      if (refId && (!old || refModule !== old.refModule || refId !== old.refId))
        await this.requestSource(user, refId, manager);
      const seen = new Set<string>(),
        items: Item[] = [];
      for (const [index, input] of dto.items.entries()) {
        const itemId = input.itemId ?? randomUUID();
        if (seen.has(itemId))
          throw new BadRequestException('품목 ID가 중복됩니다.');
        seen.add(itemId);
        const quantity = decimal(qty(input.quantity));
        if (qty(quantity) <= 0n)
          throw new BadRequestException('수량은 양수여야 합니다.');
        const oldItem = old?.items.find(
          (i) => i.itemId === itemId && i.materialId === input.materialId,
        );
        inputQuantity(input.quantity, false, oldItem?.quantity);
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          ...(oldItem ? {} : { deleteYn: 'N' }),
        });
        if (!material)
          throw new BadRequestException('같은 회사의 자재를 선택하십시오.');

        const unitPrice =
          input.unitPrice === null ||
          input.unitPrice === undefined ||
          input.unitPrice === ''
            ? null
            : decimal(inputPrice(input.unitPrice), 8);
        // 품목금액은 수량×단가를 원 단위 반올림한다. 정밀 변환만 공통 헬퍼를 사용한다.
        const item: Item = {
          companyId: user.companyId,
          orderId: id,
          itemId,
          sortOrder: index,
          materialId: input.materialId,
          materialName: oldItem?.materialName ?? material.name,
          spec:
            input.spec === undefined
              ? (oldItem?.spec ?? material.spec)
              : input.spec?.trim() || null,
          baseUnit: oldItem?.baseUnit ?? material.baseUnit,
          quantity,
          unitPrice,
          amount:
            unitPrice === null
              ? null
              : rounded(
                  qty(quantity) * price(unitPrice),
                  100000000000000n,
                ).toString(),
          note: input.note?.trim() || null,
        };
        items.push(item);
      }
      const data: Partial<Header> = {
        companyId: user.companyId,
        orderId: id,
        documentNo: dto.documentNo?.trim() ?? '',
        title: this.text(dto.title, '제목'),
        siteId,
        deptId,
        toSiteId: this.text(dto.toSiteId, '입고 예정 사업장'),
        requesterId: dto.requesterId ?? old?.requesterId ?? user.userId,
        typeCode: dto.typeCode?.trim() || null,
        content: dto.content?.trim() || null,
        note: dto.note?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        status: old?.status ?? DocumentStatus.DRAFT,
        createdBy: old?.createdBy ?? user.userId,
        deleteYn: 'N',
      };
      Object.assign(data, {
        orderDate: businessDate(dto.orderDate, true),
        expectedDeliveryDate: businessDate(dto.expectedDeliveryDate, true),
        currency: 'KRW',
        refModule,
        refId,
        totalAmount: items
          .reduce((a, i) => a + BigInt(i.amount ?? '0'), 0n)
          .toString(),
      });
      data.deliveryLocation = dto.deliveryLocation?.trim() || null;
      const vendorId =
        dto.vendorId === undefined
          ? (old?.vendorId ?? null)
          : dto.vendorId?.trim() || null;
      if (!vendorId)
        throw new BadRequestException('등록된 거래처를 선택하십시오.');
      const vendor = await manager.getRepository(Vendor).findOneBy({
        companyId: user.companyId,
        vendorId,
        ...(vendorId === old?.vendorId ? {} : { deleteYn: 'N' }),
      });
      if (!vendor)
        throw new BadRequestException(
          '같은 회사의 유효한 거래처를 선택하십시오.',
        );
      data.vendorId = vendorId;

      if (old) {
        data.updatedBy = user.userId;
        data.updatedAt = new Date();
      }
      await this.headers(manager).save(
        Object.assign(this.headers(manager).create(), old ?? {}, data),
      );
      await this.items(manager).delete({
        companyId: user.companyId,
        orderId: id,
      });
      if (items.length) await this.items(manager).save(items);
    });
    // 대상 접근 검사는 수정 전에 수행한다. 저장 응답은 입력 소속으로 재검사하지 않는다.
    const saved = await this.headers().findOneByOrFail({
      companyId: user.companyId,
      orderId: id,
    });
    const savedItems = await this.items().find({
      where: { companyId: user.companyId, orderId: id },
      order: { sortOrder: 'ASC' },
    });
    const vendor = saved.vendorId
      ? await (this.transactionManager ?? this.db)
          .getRepository(Vendor)
          .findOneBy({
            companyId: user.companyId,
            vendorId: saved.vendorId,
            deleteYn: 'N',
          })
      : null;
    return Object.assign({}, saved, { items: savedItems, vendor });
  }
  async assertCanSubmit(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    if (!row.items.length)
      throw new BadRequestException('품목을 입력하십시오.');
    businessDate(row.orderDate);
    this.text(row.toSiteId, '입고 예정 사업장');
    if (
      !row.vendorId ||
      !(await (this.transactionManager ?? this.db)
        .getRepository(Vendor)
        .findOneBy({
          companyId: user.companyId,
          vendorId: row.vendorId,
        }))
    )
      throw new BadRequestException(
        '같은 회사의 유효한 거래처를 선택하십시오.',
      );
    if (row.items.some((i) => i.unitPrice === null))
      throw new BadRequestException('발주 단가를 입력하십시오.');
    for (const item of row.items) {
      const material = await (this.transactionManager ?? this.db)
        .getRepository(Material)
        .findOneBy({
          companyId: user.companyId,
          materialId: item.materialId,
          deleteYn: 'N',
        });
      if (!material || material.baseUnit !== item.baseUnit)
        throw new BadRequestException('삭제되었거나 단위가 변경된 자재입니다.');
    }
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    await this.headers().update(
      { companyId: user.companyId, orderId: id },
      { deleteYn: 'Y', updatedBy: user.userId, updatedAt: new Date() },
    );
    return { success: true };
  }
  async syncApprovalStatus(
    companyId: string,
    id: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const row = await this.headers().findOneBy({
      companyId,
      orderId: id,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('구매 문서가 없습니다.');
    if (row.status === status) return;
    if (
      (status === 'P' && row.status !== DocumentStatus.DRAFT) ||
      (status !== 'P' && row.status !== DocumentStatus.PROGRESS)
    )
      throw new ConflictException('구매 문서 상태가 변경되었습니다.');
    await this.headers().update(
      { companyId, orderId: id },
      { status, updatedBy, updatedAt: new Date() },
    );
  }
}
