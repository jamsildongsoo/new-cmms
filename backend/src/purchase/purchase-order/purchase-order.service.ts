import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseRequestService } from '../purchase-request/purchase-request.service';
/** 구매발주의 벤더·금액·요청 병합 및 Allocation을 관리한다. */
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
import { applyDocumentScope } from '../../common/utils/document-scope.util';
import { businessDate } from '../../common/utils/posting-date';
import {
  decimal,
  lineAmount,
  price,
  qty,
} from '../../common/utils/stock-decimal';
import { DocumentStatus } from '../../common/constants/document-status';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Material } from '../../inventory/material/entities/material.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { User } from '../../identity/users/entities/user.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseRequestItem } from '../purchase-request/entities/purchase-request-item.entity';
import { PurchaseOrderItem } from '../purchase-order/entities/purchase-order-item.entity';
import { PurchaseOrderAllocation } from '../purchase-order/entities/purchase-order-allocation.entity';
import { Vendor } from '../vendor/entities/vendor.entity';
import { PurchaseOrderSaveDto } from './dto/purchase-order.dto';
import { PurchaseSearchDto } from '../common/purchase-search.dto';
type Header = PurchaseOrder & {
  vendor?: Vendor | null;
};
type Item = PurchaseOrderItem;
@Injectable()
export class PurchaseOrderService {
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
  private headers(manager = this.db.manager) {
    return manager.getRepository<Header>(PurchaseOrder);
  }
  private items(manager = this.db.manager) {
    return manager.getRepository(PurchaseOrderItem);
  }
  private scoped(user: UserContext, manager = this.db.manager) {
    const query = this.headers(manager).createQueryBuilder('p');
    query.leftJoinAndMapOne(
      'p.vendor',
      Vendor,
      'vendor',
      'vendor.companyId = p.companyId AND vendor.vendorId = p.vendorId',
    );
    return applyDocumentScope(query, user, 'p');
  }
  async findAll(user: UserContext, filter: PurchaseSearchDto = {}) {
    const q = this.scoped(user).orderBy('p.createdAt', 'DESC');
    if (filter.status)
      q.andWhere('p.status = :status', { status: filter.status });
    if (filter.search?.trim())
      q.andWhere(
        `(p.title ILIKE :search OR p.documentNo ILIKE :search OR p.orderId ILIKE :search)`,
        {
          search: `%${filter.search.trim()}%`,
        },
      );
    const date = 'orderDate';
    if (filter.from)
      q.andWhere(`p.${date} >= :from`, { from: businessDate(filter.from) });
    if (filter.to)
      q.andWhere(`p.${date} <= :to`, { to: businessDate(filter.to) });
    return q.getMany();
  }
  async findOne(user: UserContext, id: string, manager = this.db.manager) {
    const row = await this.scoped(user, manager)
      .andWhere(`p.orderId = :id`, { id })
      .getOne();
    if (!row)
      throw new NotFoundException('구매 문서가 없거나 조회 범위 밖입니다.');
    const items = await this.items(manager).find({
      where: { companyId: user.companyId, orderId: id },
      order: { sortOrder: 'ASC' },
    });
    const allocations = await manager
      .getRepository(PurchaseOrderAllocation)
      .find({ where: { companyId: user.companyId, orderId: id } });
    return Object.assign({}, row, { items, allocations });
  }
  private editable(user: UserContext, row: Header) {
    if (row.status !== 'D' || row.createdBy !== user.userId)
      throw new ForbiddenException('작성자만 초안을 처리할 수 있습니다.');
  }
  private text(value: unknown, label: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${label}을 입력하십시오.`);
    return value.trim();
  }
  private mergeKey(item: {
    materialId: string;
    spec: string | null;
    baseUnit: string;
  }) {
    return JSON.stringify([item.materialId, item.spec, item.baseUnit]);
  }
  private async sourceItems(
    user: UserContext,
    ids: string[],
    manager: EntityManager,
  ) {
    const groups = new Map<
      string,
      {
        item: PurchaseRequestItem;
        links: {
          requestId: string;
          requestItemId: string;
          quantity: string;
        }[];
      }
    >();
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('요청을 중복 선택했습니다.');
    for (const id of ids) {
      const source = await this.requests.findOne(user, id, manager);
      if (source.status !== 'C' || !source.items.length)
        throw new BadRequestException('완결(C) 구매요청만 선택하십시오.');
      for (const item of source.items) {
        const key = this.mergeKey(item),
          existing = groups.get(key),
          link = {
            requestId: id,
            requestItemId: item.itemId,
            quantity: item.quantity,
          };
        if (existing) {
          existing.item.quantity = decimal(
            qty(existing.item.quantity) + qty(item.quantity),
          );
          existing.links.push(link);
        } else
          groups.set(key, {
            item: Object.assign({}, item, {
              itemId: randomUUID(),
              quantity: decimal(qty(item.quantity)),
            }),
            links: [link],
          });
      }
    }
    return [...groups.values()];
  }
  async preview(user: UserContext, ids: string[]) {
    const groups = await this.sourceItems(user, ids, this.db.manager);
    const linked = ids.length
      ? await this.db
          .getRepository(PurchaseOrderAllocation)
          .createQueryBuilder('a')
          .innerJoin(
            PurchaseOrder,
            'o',
            'o.companyId=a.companyId AND o.orderId=a.orderId',
          )
          .where('a.companyId=:companyId', { companyId: user.companyId })
          .andWhere('a.requestId IN (:...ids)', { ids })
          .andWhere("o.deleteYn='N'")
          .getExists()
      : false;
    return {
      items: groups.map((g) =>
        Object.assign({}, g.item, { unitPrice: null, amount: null }),
      ),
      hasLinkedOrders: linked,
      message: linked ? '기존 연결된 발주건이 있습니다.' : null,
    };
  }
  async options(user: UserContext) {
    this.scoped(user);
    const companyId = user.companyId;
    const [materials, sites, departments, users, types] = await Promise.all([
      this.db.getRepository(Material).find({
        where: { companyId, deleteYn: 'N' },
        order: { materialId: 'ASC' },
      }),
      this.db.getRepository(Site).find({ where: { companyId, deleteYn: 'N' } }),
      this.db
        .getRepository(Department)
        .find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(User).find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(CodeItem).find({
        where: { companyId, codeId: 'PURCHASE_ORDER_TYPE' },
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
      this.requests.findAll(user, { status: 'C' }),
      this.db.getRepository(Vendor).find({
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
  async save(
    user: UserContext,
    id: string,
    dto: PurchaseOrderSaveDto,
    create: boolean,
  ) {
    await this.db.transaction(async (manager) => {
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
      // 새 소속이 OWN_SITE/부서 scope 밖인지 문서와 동일한 조건으로 검사한다.
      if (user.accessScope === 'OWN_SITE' && siteId !== user.siteId)
        throw new ForbiddenException('사업장 범위 밖입니다.');
      if (user.accessScope === 'OWN_DEPARTMENT') {
        const allowed = await manager
          .getRepository(Department)
          .createQueryBuilder('d')
          .where('d.companyId=:companyId', { companyId: user.companyId })
          .andWhere(
            `d.deptId IN (WITH RECURSIVE ds AS (SELECT "deptId" FROM department WHERE "companyId"=:companyId AND "deptId"=:deptId AND "deleteYn"='N' UNION SELECT d."deptId" FROM department d JOIN ds ON d."parentDeptId"=ds."deptId" WHERE d."companyId"=:companyId AND d."deleteYn"='N') SELECT "deptId" FROM ds)`,
            { deptId: user.deptId },
          )
          .getMany();
        if (!allowed.some((d) => d.deptId === deptId))
          throw new ForbiddenException('부서 범위 밖입니다.');
      }
      this.scoped(user, manager);
      if (
        dto.typeCode &&
        (!old || dto.typeCode !== old.typeCode) &&
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId: 'PURCHASE_ORDER_TYPE',
          codeItemId: dto.typeCode,
        }))
      )
        throw new BadRequestException('유형 코드가 없습니다.');
      const ids = dto.requestIds ?? old?.sourceRequestIds ?? [];
      const groups = ids.length
        ? await this.sourceItems(user, ids, manager)
        : [];
      if (ids.length && groups.length !== dto.items.length)
        throw new BadRequestException('요청 전체 품목·수량을 유지하십시오.');
      const seen = new Set<string>(),
        usedGroups = new Set<string>(),
        items: Item[] = [],
        allocations: PurchaseOrderAllocation[] = [];
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
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          ...(oldItem ? {} : { deleteYn: 'N' }),
        });
        if (!material)
          throw new BadRequestException('같은 회사의 자재를 선택하십시오.');
        const matches = groups.filter(
          (g) =>
            g.item.materialId === input.materialId &&
            qty(g.item.quantity) === qty(quantity) &&
            !usedGroups.has(this.mergeKey(g.item)),
        );
        const group = ids.length
          ? (matches.find(
              (g) =>
                oldItem && this.mergeKey(g.item) === this.mergeKey(oldItem),
            ) ?? matches[0])
          : null;
        if (ids.length && !group)
          throw new BadRequestException('요청 품목·수량은 변경할 수 없습니다.');
        if (group) usedGroups.add(this.mergeKey(group.item));
        const snapshot = group?.item ?? oldItem;

        const unitPrice =
          input.unitPrice === null ||
          input.unitPrice === undefined ||
          input.unitPrice === ''
            ? null
            : decimal(price(input.unitPrice), 8);
        const item: Item = {
          companyId: user.companyId,
          orderId: id,
          itemId,
          sortOrder: index,
          materialId: input.materialId,
          materialName: snapshot?.materialName ?? material.name,
          spec: snapshot?.spec ?? material.spec,
          baseUnit: snapshot?.baseUnit ?? material.baseUnit,
          quantity,
          unitPrice,
          amount: unitPrice === null ? null : lineAmount(quantity, unitPrice),
          note: input.note?.trim() || null,
        };
        items.push(item);
        for (const link of group?.links ?? [])
          allocations.push(
            Object.assign(new PurchaseOrderAllocation(), {
              companyId: user.companyId,
              allocationId: randomUUID(),
              orderId: id,
              orderItemId: itemId,
              ...link,
            }),
          );
      }
      const data: Partial<Header> = {
        companyId: user.companyId,
        orderId: id,
        documentNo: dto.documentNo?.trim() ?? '',
        title: this.text(dto.title, '제목'),
        siteId,
        deptId,
        requesterId: dto.requesterId ?? old?.requesterId ?? user.userId,
        typeCode: dto.typeCode?.trim() || null,
        content: dto.content?.trim() || null,
        note: dto.note?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        status: old?.status ?? 'D',
        createdBy: old?.createdBy ?? user.userId,
        deleteYn: 'N',
      };
      {
        Object.assign(data, {
          orderDate: businessDate(dto.orderDate, true),
          expectedDeliveryDate: businessDate(dto.expectedDeliveryDate, true),
          currency: 'KRW',
          sourceRequestIds: ids,
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
          throw new BadRequestException('등록된 벤더를 선택하십시오.');
        const vendor = await manager.getRepository(Vendor).findOneBy({
          companyId: user.companyId,
          vendorId,
          ...(vendorId === old?.vendorId ? {} : { deleteYn: 'N' }),
        });
        if (!vendor)
          throw new BadRequestException(
            '같은 회사의 유효한 벤더를 선택하십시오.',
          );
        data.vendorId = vendorId;
      }
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
      {
        await manager
          .getRepository(PurchaseOrderAllocation)
          .delete({ companyId: user.companyId, orderId: id });
        if (allocations.length)
          await manager
            .getRepository(PurchaseOrderAllocation)
            .save(allocations);
      }
    });
    return this.findOne(user, id);
  }
  async assertCanSubmit(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    if (!row.items.length)
      throw new BadRequestException('품목을 입력하십시오.');
    businessDate(row.orderDate);
    {
      if (
        !row.vendorId ||
        !(await this.db.getRepository(Vendor).findOneBy({
          companyId: user.companyId,
          vendorId: row.vendorId,
        }))
      )
        throw new BadRequestException(
          '같은 회사의 유효한 벤더를 선택하십시오.',
        );
    }
    if (row.items.some((i) => i.unitPrice === null))
      throw new BadRequestException('발주 단가를 입력하십시오.');
    for (const item of row.items) {
      const material = await this.db.getRepository(Material).findOneBy({
        companyId: user.companyId,
        materialId: item.materialId,
        deleteYn: 'N',
      });
      if (!material || material.baseUnit !== item.baseUnit)
        throw new BadRequestException('삭제되었거나 단위가 변경된 자재입니다.');
    }
    if (row.sourceRequestIds?.length) {
      const expected = await this.sourceItems(
        user,
        row.sourceRequestIds,
        this.db.manager,
      );
      if (expected.length !== row.items.length)
        throw new BadRequestException('요청 품목이 일치하지 않습니다.');
      const actual = new Map(row.items.map((i) => [this.mergeKey(i), i]));
      for (const group of expected) {
        const item = actual.get(this.mergeKey(group.item));
        if (!item || qty(item.quantity) !== qty(group.item.quantity))
          throw new BadRequestException('요청 수량을 유지하십시오.');
      }
    }
  }
  async remove(user: UserContext, id: string) {
    const row = await this.findOne(user, id);
    this.editable(user, row);
    await this.headers().update(
      { companyId: user.companyId, orderId: id },
      { deleteYn: 'Y', updatedBy: user.userId, updatedAt: new Date() },
    );
    return row;
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
      (status === 'P' && row.status !== 'D') ||
      (status !== 'P' && row.status !== 'P')
    )
      throw new ConflictException('구매 문서 상태가 변경되었습니다.');
    await this.headers().update(
      { companyId, orderId: id },
      { status, updatedBy, updatedAt: new Date() },
    );
  }
}
