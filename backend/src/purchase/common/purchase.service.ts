/** 회사·문서 범위 안에서 요청/발주를 저장하고 전체 요청 병합과 품목별 allocation 출처를 보존한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, EntityTarget } from 'typeorm';
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
import { PurchaseRequest } from '../purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { PurchaseOrderAllocation } from './purchase-order-allocation.entity';
import { Vendor } from '../vendor/entities/vendor.entity';
import { PurchaseSaveDto, PurchaseSearchDto } from './purchase.dto';
export type PurchaseKind = 'request' | 'order';
type Header = PurchaseRequest & Partial<PurchaseOrder>;
type Item = Omit<PurchaseRequestItem, 'requestId'> & {
  requestId?: string;
  orderId?: string;
  unitPrice?: string | null;
  amount?: string | null;
};
@Injectable()
export class PurchaseService {
  constructor(private readonly db: DataSource) {}
  private headers(kind: PurchaseKind, manager = this.db.manager) {
    return manager.getRepository<Header>(
      (kind === 'request'
        ? PurchaseRequest
        : PurchaseOrder) as EntityTarget<Header>,
    );
  }
  private items(kind: PurchaseKind, manager = this.db.manager) {
    return manager.getRepository<Item>(
      (kind === 'request'
        ? PurchaseRequestItem
        : PurchaseOrderItem) as EntityTarget<Item>,
    );
  }
  private key(kind: PurchaseKind) {
    return kind === 'request' ? 'requestId' : 'orderId';
  }
  private scoped(
    kind: PurchaseKind,
    user: UserContext,
    manager = this.db.manager,
  ) {
    return applyDocumentScope(
      this.headers(kind, manager).createQueryBuilder('p'),
      user,
      'p',
    );
  }
  async list(
    kind: PurchaseKind,
    user: UserContext,
    filter: PurchaseSearchDto = {},
  ) {
    const q = this.scoped(kind, user).orderBy('p.createdAt', 'DESC');
    if (filter.status)
      q.andWhere('p.status = :status', { status: filter.status });
    if (filter.search?.trim())
      q.andWhere(
        `(p.title ILIKE :search OR p.documentNo ILIKE :search OR p.${this.key(kind)} ILIKE :search)`,
        {
          search: `%${filter.search.trim()}%`,
        },
      );
    const date = kind === 'request' ? 'requestDate' : 'orderDate';
    if (filter.from)
      q.andWhere(`p.${date} >= :from`, { from: businessDate(filter.from) });
    if (filter.to)
      q.andWhere(`p.${date} <= :to`, { to: businessDate(filter.to) });
    return q.getMany();
  }
  async get(
    kind: PurchaseKind,
    user: UserContext,
    id: string,
    manager = this.db.manager,
  ) {
    const row = await this.scoped(kind, user, manager)
      .andWhere(`p.${this.key(kind)} = :id`, { id })
      .getOne();
    if (!row)
      throw new NotFoundException('구매 문서가 없거나 조회 범위 밖입니다.');
    const items = await this.items(kind, manager).find({
      where: { companyId: user.companyId, [this.key(kind)]: id },
      order: { sortOrder: 'ASC' },
    });
    const allocations =
      kind === 'order'
        ? await manager
            .getRepository(PurchaseOrderAllocation)
            .find({ where: { companyId: user.companyId, orderId: id } })
        : [];
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
        item: Item;
        links: { requestId: string; requestItemId: string; quantity: string }[];
      }
    >();
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('요청을 중복 선택했습니다.');
    for (const id of ids) {
      const source = await this.get('request', user, id, manager);
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
      items: groups.map((g) => ({ ...g.item, unitPrice: null, amount: null })),
      hasLinkedOrders: linked,
      message: linked ? '기존 연결된 발주건이 있습니다.' : null,
    };
  }
  async options(kind: PurchaseKind, user: UserContext) {
    // 선택 API는 구매 권한을 사용하고 인증 회사의 최소 마스터 정보만 제공한다.
    this.scoped(kind, user);
    const companyId = user.companyId;
    const [materials, sites, departments, users, types, requests, vendors] =
      await Promise.all([
        this.db.getRepository(Material).find({
          where: { companyId, deleteYn: 'N' },
          order: { materialId: 'ASC' },
        }),
        this.db
          .getRepository(Site)
          .find({ where: { companyId, deleteYn: 'N' } }),
        this.db
          .getRepository(Department)
          .find({ where: { companyId, deleteYn: 'N' } }),
        this.db
          .getRepository(User)
          .find({ where: { companyId, deleteYn: 'N' } }),
        this.db.getRepository(CodeItem).find({
          where: {
            companyId,
            codeId:
              kind === 'request'
                ? 'PURCHASE_REQUEST_TYPE'
                : 'PURCHASE_ORDER_TYPE',
          },
          order: { sortOrder: 'ASC' },
        }),
        kind === 'order'
          ? this.list('request', user, { status: 'C' })
          : Promise.resolve([]),
        kind === 'order'
          ? this.db.getRepository(Vendor).find({
              where: { companyId, deleteYn: 'N' },
              order: { vendorId: 'ASC' },
            })
          : Promise.resolve([]),
      ]);
    return {
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
      vendors: vendors.map(
        ({ vendorId, name, registrationNo, contactName, phone, email }) => ({
          vendorId,
          name,
          registrationNo,
          contactName,
          phone,
          email,
        }),
      ),
      requests: requests.map((r) => ({
        requestId: r.requestId,
        documentNo: r.documentNo,
        title: r.title,
      })),
    };
  }
  async save(
    kind: PurchaseKind,
    user: UserContext,
    id: string,
    dto: PurchaseSaveDto,
    create: boolean,
  ) {
    await this.db.transaction(async (manager) => {
      let old: Awaited<ReturnType<PurchaseService['get']>> | null = null;
      if (!create) {
        old = await this.get(kind, user, id, manager);
        this.editable(user, old);
      } else if (
        await this.headers(kind, manager).findOneBy({
          companyId: user.companyId,
          [this.key(kind)]: id,
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
      this.scoped(kind, user, manager);
      if (
        dto.typeCode &&
        (!old || dto.typeCode !== old.typeCode) &&
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId:
            kind === 'request'
              ? 'PURCHASE_REQUEST_TYPE'
              : 'PURCHASE_ORDER_TYPE',
          codeItemId: dto.typeCode,
        }))
      )
        throw new BadRequestException('유형 코드가 없습니다.');
      const ids =
        kind === 'order' ? (dto.requestIds ?? old?.sourceRequestIds ?? []) : [];
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
        if (kind === 'request' && input.unitPrice != null)
          throw new BadRequestException(
            '구매요청에는 단가를 입력하지 않습니다. 비교 견적은 첨부하십시오.',
          );
        const unitPrice =
          kind === 'request' ||
          input.unitPrice === null ||
          input.unitPrice === undefined ||
          input.unitPrice === ''
            ? null
            : decimal(price(input.unitPrice), 8);
        const item: Item = {
          companyId: user.companyId,
          [this.key(kind)]: id,
          itemId,
          sortOrder: index,
          materialId: input.materialId,
          materialName: snapshot?.materialName ?? material.name,
          spec: snapshot?.spec ?? material.spec,
          baseUnit: snapshot?.baseUnit ?? material.baseUnit,
          quantity,
          ...(kind === 'order'
            ? {
                unitPrice,
                amount:
                  unitPrice === null ? null : lineAmount(quantity, unitPrice),
              }
            : {}),
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
        [this.key(kind)]: id,
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
      if (kind === 'request')
        Object.assign(data, {
          requestDate: businessDate(dto.requestDate, true),
          requiredDate: businessDate(dto.requiredDate, true),
        });
      else {
        Object.assign(data, {
          orderDate: businessDate(dto.orderDate, true),
          expectedDeliveryDate: businessDate(dto.expectedDeliveryDate, true),
          currency: 'KRW',
          sourceRequestIds: ids,
          totalAmount: items
            .reduce((a, i) => a + BigInt(i.amount ?? '0'), 0n)
            .toString(),
        });
        for (const key of [
          'supplierName',
          'supplierRegistrationNo',
          'supplierContactName',
          'supplierPhone',
          'supplierEmail',
          'deliveryLocation',
        ] as const)
          data[key] = dto[key]?.trim() || null;
        const vendorId =
          dto.vendorId === undefined
            ? (old?.vendorId ?? null)
            : dto.vendorId?.trim() || null;
        data.vendorId = vendorId;
        if (vendorId && vendorId !== old?.vendorId) {
          const vendor = await manager
            .getRepository(Vendor)
            .findOneBy({ companyId: user.companyId, vendorId, deleteYn: 'N' });
          if (!vendor)
            throw new BadRequestException(
              '같은 회사의 유효한 벤더를 선택하십시오.',
            );
          // 새 선택 시 마스터 값을 snapshot으로 저장한다. 이후 마스터 변경/삭제는 기존 발주에 전파하지 않는다.
          Object.assign(data, {
            supplierName: vendor.name,
            supplierRegistrationNo: vendor.registrationNo,
            supplierContactName: vendor.contactName,
            supplierPhone: vendor.phone,
            supplierEmail: vendor.email,
          });
        }
      }
      if (old) {
        data.updatedBy = user.userId;
        data.updatedAt = new Date();
      }
      await this.headers(kind, manager).save(
        Object.assign(this.headers(kind, manager).create(), old ?? {}, data),
      );
      await this.items(kind, manager).delete({
        companyId: user.companyId,
        [this.key(kind)]: id,
      });
      if (items.length) await this.items(kind, manager).save(items);
      if (kind === 'order') {
        await manager
          .getRepository(PurchaseOrderAllocation)
          .delete({ companyId: user.companyId, orderId: id });
        if (allocations.length)
          await manager
            .getRepository(PurchaseOrderAllocation)
            .save(allocations);
      }
    });
    return this.get(kind, user, id);
  }
  async assertCanSubmit(kind: PurchaseKind, user: UserContext, id: string) {
    const row = await this.get(kind, user, id);
    this.editable(user, row);
    if (!row.items.length)
      throw new BadRequestException('품목을 입력하십시오.');
    businessDate(kind === 'request' ? row.requestDate : row.orderDate);
    if (kind === 'order' && !row.supplierName?.trim())
      throw new BadRequestException('공급처를 입력하십시오.');
    if (kind === 'order' && row.items.some((i) => i.unitPrice === null))
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
    if (kind === 'order' && row.sourceRequestIds?.length) {
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
  async remove(kind: PurchaseKind, user: UserContext, id: string) {
    const row = await this.get(kind, user, id);
    this.editable(user, row);
    await this.headers(kind).update(
      { companyId: user.companyId, [this.key(kind)]: id },
      { deleteYn: 'Y', updatedBy: user.userId, updatedAt: new Date() },
    );
    return row;
  }
  async sync(
    kind: PurchaseKind,
    companyId: string,
    id: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const row = await this.headers(kind).findOneBy({
      companyId,
      [this.key(kind)]: id,
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('구매 문서가 없습니다.');
    if (row.status === status) return;
    if (
      (status === 'P' && row.status !== 'D') ||
      (status !== 'P' && row.status !== 'P')
    )
      throw new ConflictException('구매 문서 상태가 변경되었습니다.');
    await this.headers(kind).update(
      { companyId, [this.key(kind)]: id },
      { status, updatedBy, updatedAt: new Date() },
    );
  }
}
