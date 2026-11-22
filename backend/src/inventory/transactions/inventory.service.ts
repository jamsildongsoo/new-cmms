import { inputQuantity, inputPrice } from '../../common/utils/decimal.util';
/** 전표 확정·대기 입고 수령·취소를 회사 잠금과 단일 트랜잭션으로 처리한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NumberingService } from '../../numbering/numbering.service';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { ModuleCode } from '../../common/constants/modules';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { businessDate } from '../../common/utils/date.util';
import { decimal, rounded, price, qty } from '../../common/utils/decimal.util';
import { Material } from '../material/entities/material.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Warehouse } from '../../organization/warehouses/entities/warehouse.entity';
import { PurchaseOrderItem } from '../../purchase/purchase-order/entities/purchase-order-item.entity';
import { PurchaseOrder } from '../../purchase/purchase-order/entities/purchase-order.entity';
import { InventoryDocument } from './entities/inventory-document.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryControl } from './entities/inventory-control.entity';
import { InventoryPeriodLock } from '../monthly-closing/entities/inventory-period-lock.entity';

import { StockProcessingService } from '../stock/stock-processing.service';
import { inventoryVariant } from '../inventory.constant';
import { CreateInventoryDto, InventorySearchDto } from './dto/inventory.dto';
@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DataSource,
    private readonly stock: StockProcessingService,
    private readonly numbering: NumberingService,
  ) {}
  /** 재고는 부서로 구분하지 않는다. OWN_SITE·OWN_DEPARTMENT 모두 소속 사업장 조건으로 제한한다. */
  private scoped(user: UserContext, manager = this.db.manager) {
    const q = manager
      .getRepository(InventoryDocument)
      .createQueryBuilder('d')
      .where('d.companyId=:companyId', { companyId: user.companyId })
      .andWhere("d.deleteYn='N'");
    if (user.accessScope === 'COMPANY_ALL') return q;
    if (
      (user.accessScope === 'OWN_SITE' ||
        user.accessScope === 'OWN_DEPARTMENT') &&
      user.siteId
    )
      return q.andWhere('d.siteId=:scopeSiteId', { scopeSiteId: user.siteId });
    throw new ForbiddenException('재고 조회 범위 또는 소속 사업장이 없습니다.');
  }
  async list(user: UserContext, filter: InventorySearchDto = {}) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const q = this.scoped(user)
      .select([
        'd.inventoryDocumentId',
        'd.documentNo',
        'd.title',
        'd.type',
        'd.kind',
        'd.postingDate',
        'd.siteId',
        'd.warehouseId',
        'd.status',
      ])
      .orderBy('d.createdAt', 'DESC')
      .addOrderBy('d.inventoryDocumentId', 'DESC');
    if (filter.search?.trim())
      q.andWhere(
        '(d.inventoryDocumentId ILIKE :search OR d.documentNo ILIKE :search OR d.title ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    for (const field of [
      'type',
      'kind',
      'status',
      'siteId',
      'warehouseId',
    ] as const) {
      if (filter[field])
        q.andWhere(`d.${field} = :${field}`, { [field]: filter[field] });
    }
    if (filter.from)
      q.andWhere('d."postingDate" >= :from', {
        from: businessDate(filter.from),
      });
    if (filter.to)
      q.andWhere('d."postingDate" <= :to', { to: businessDate(filter.to) });
    if (filter.materialId)
      q.andWhere(
        'EXISTS (SELECT 1 FROM inventory_item i WHERE i."companyId" = d."companyId" AND i."inventoryDocumentId" = d."inventoryDocumentId" AND i."materialId" = :materialId)',
        { materialId: filter.materialId },
      );
    const [rows, total] = await q.skip(offset).take(limit).getManyAndCount();
    return {
      items: rows.map(
        ({
          inventoryDocumentId,
          documentNo,
          title,
          type,
          kind,
          postingDate,
          siteId,
          warehouseId,
          status,
        }) => ({
          inventoryDocumentId,
          documentNo,
          title,
          type,
          kind,
          postingDate,
          siteId,
          warehouseId,
          status,
        }),
      ),
      total,
      page,
      limit,
    };
  }
  async get(user: UserContext, id: string, manager = this.db.manager) {
    const row = await this.scoped(user, manager)
      .andWhere('d.inventoryDocumentId=:id', { id })
      .getOne();
    if (!row) throw new NotFoundException('재고전표가 없거나 범위 밖입니다.');
    const items = await manager.getRepository(InventoryItem).find({
      where: { companyId: user.companyId, inventoryDocumentId: id },
      order: { sortOrder: 'ASC' },
    });
    const origin =
      row.kind === 'TRANSFER' && row.type === 'IN' && row.refId
        ? await manager.getRepository(InventoryDocument).findOneBy({
            companyId: user.companyId,
            inventoryDocumentId: row.refId,
            deleteYn: 'N',
          })
        : null;
    return Object.assign({}, row, {
      items,
      sourceSiteId: origin?.siteId ?? null,
      sourceWarehouseId: origin?.warehouseId ?? null,
    });
  }
  private async openPeriod(
    companyId: string,
    date: string,
    manager: EntityManager,
  ) {
    businessDate(date);
    const period = await manager
      .getRepository(InventoryPeriodLock)
      .findOneBy({ companyId, yearMonth: date.slice(0, 6) });
    if (!period || period.locked)
      throw new ConflictException('전기월이 개시되지 않았거나 마감되었습니다.');
    // 소급 처리로 이미 마감된 후속 월의 평가가 바뀌지 않도록 잠금 해제를 요구한다.
    const later = await manager
      .getRepository(InventoryPeriodLock)
      .createQueryBuilder('p')
      .where('p.companyId=:companyId', { companyId })
      .andWhere('p.yearMonth > :month', { month: date.slice(0, 6) })
      .andWhere('p.locked=true')
      .getExists();
    if (later)
      throw new ConflictException(
        '영향받는 후속 마감 월을 해제한 후 처리하십시오.',
      );
    return period;
  }
  private async warehouse(
    companyId: string,
    siteId: string,
    warehouseId: string,
    manager: EntityManager,
  ) {
    if (
      !(await manager
        .getRepository(Warehouse)
        .findOneBy({ companyId, siteId, warehouseId, deleteYn: 'N' }))
    )
      throw new BadRequestException(
        '같은 회사 사업장의 유효한 창고를 선택하십시오.',
      );
  }
  async options(user: UserContext) {
    this.scoped(user);
    const [materials, sites, warehouses, periods] = await Promise.all([
      this.db.getRepository(Material).find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { materialId: 'ASC' },
      }),
      this.db.getRepository(Site).find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { siteId: 'ASC' },
      }),
      this.db.getRepository(Warehouse).find({
        where: { companyId: user.companyId, deleteYn: 'N' },
        order: { siteId: 'ASC', warehouseId: 'ASC' },
      }),
      this.db.getRepository(InventoryPeriodLock).find({
        where: { companyId: user.companyId },
        order: { yearMonth: 'DESC' },
      }),
    ]);
    // 입고 후보는 발주 소속이 아닌 목적지 기준이다. 구매 화면 자체의 scope는 변경하지 않는다.
    const orders =
      user.accessScope === 'COMPANY_ALL' || user.siteId
        ? await this.db.getRepository(PurchaseOrder).find({
            where: {
              companyId: user.companyId,
              ...(user.accessScope === 'COMPANY_ALL'
                ? {}
                : { toSiteId: user.siteId! }),
              status: 'C',
              deleteYn: 'N',
            },
            select: { orderId: true, documentNo: true, title: true },
            order: { createdAt: 'DESC', orderId: 'DESC' },
          })
        : [];
    const receipts = await this.db.getRepository(InventoryDocument).find({
      where: {
        companyId: user.companyId,
        refModule: ModuleCode.PURORD,
        status: 'C',
        deleteYn: 'N',
      },
      select: { refId: true },
    });
    const receivedIds = new Set(receipts.map((row) => row.refId));
    return {
      materials: materials.map(({ materialId, name, spec, baseUnit }) => ({
        materialId,
        name,
        spec,
        baseUnit,
      })),
      sites: sites.map((s) => ({ value: s.siteId, label: s.name })),
      warehouses: warehouses.map((w) => ({
        siteId: w.siteId,
        warehouseId: w.warehouseId,
        name: w.name,
      })),
      orders: orders.filter((order) => !receivedIds.has(order.orderId)),
      periods,
    };
  }
  private assertSite(user: UserContext, siteId: string) {
    if (user.accessScope === 'COMPANY_ALL') return;
    if (
      (user.accessScope === 'OWN_SITE' ||
        user.accessScope === 'OWN_DEPARTMENT') &&
      user.siteId === siteId
    )
      return;
    throw new ForbiddenException('처리 사업장 범위 밖입니다.');
  }

  /** 입고용 원문은 발주 작성 사업장이 아닌 수령 사업장(toSiteId)으로 접근을 검사한다. */
  async purchaseOrder(
    user: UserContext,
    id: string,
    manager = this.db.manager,
  ) {
    const order = await manager.getRepository(PurchaseOrder).findOneBy({
      companyId: user.companyId,
      orderId: id,
      status: 'C',
      deleteYn: 'N',
    });
    if (!order || !order.toSiteId)
      throw new NotFoundException('완결된 발주가 없습니다.');
    if (user.accessScope !== 'COMPANY_ALL' && order.toSiteId !== user.siteId)
      throw new ForbiddenException('입고 사업장 범위 밖입니다.');
    const items = await manager.getRepository(PurchaseOrderItem).find({
      where: { companyId: user.companyId, orderId: id },
      order: { sortOrder: 'ASC' },
    });
    return {
      title: order.title,
      siteId: order.toSiteId,
      items: items.map((i) => ({
        refItemId: i.itemId,
        materialId: i.materialId,
        materialName: i.materialName,
        spec: i.spec,
        baseUnit: i.baseUnit,
        quantity: i.quantity,
        unitPrice: i.unitPrice ?? '0',
      })),
    };
  }
  /** 문서번호와 다른 회사 전체 확정순번이다. 호출자는 회사 잠금을 보유하며 취소해도 카운터를 되돌리지 않는다. */
  private async sequence(manager: EntityManager, companyId: string) {
    const repo = manager.getRepository(InventoryControl);
    const row =
      (await repo.findOneBy({ companyId })) ??
      repo.create({ companyId, lastSequence: '0' });
    row.lastSequence = (BigInt(row.lastSequence) + 1n).toString();
    await repo.save(row);
    return row.lastSequence;
  }
  /** 원문 중복·전체 품목·월 잠금을 확인하고 전표와 해당 잔고 변경을 같은 트랜잭션에서 저장한다. */
  async create(user: UserContext, dto: CreateInventoryDto) {
    const id = dto.inventoryDocumentId;
    if (!id) throw new BadRequestException('서버 문서번호가 없습니다.');
    const movingOut = dto.type === 'OUT' && dto.kind === 'TRANSFER';
    // 공통 채번 정책대로 저장 전 번호를 확보하며 실패 번호는 재사용하지 않는다.
    const incomingId = movingOut
      ? await this.numbering.generateDocumentId(
          user.companyId,
          ModuleCode.INVDOC,
        )
      : null;
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      this.assertSite(user, dto.siteId);
      await this.openPeriod(user.companyId, dto.postingDate, manager);
      if (
        !inventoryVariant(dto.type, dto.kind) ||
        (dto.type === 'IN' && dto.kind === 'TRANSFER')
      )
        throw new BadRequestException('허용되지 않은 신규 수불 유형입니다.');
      const docs = manager.getRepository(InventoryDocument);
      if (
        await docs.existsBy({
          companyId: user.companyId,
          inventoryDocumentId: id,
        })
      )
        throw new ConflictException('중복 문서 ID입니다.');
      await this.warehouse(
        user.companyId,
        dto.siteId,
        dto.warehouseId,
        manager,
      );
      if (!dto.title.trim() || !dto.items.length)
        throw new BadRequestException('전표명과 품목을 입력하십시오.');
      if (dto.type === 'ADJUST' && !dto.reason?.trim())
        throw new BadRequestException('조정 사유를 입력하십시오.');
      const linked = dto.type === 'IN' && dto.kind === 'PURCHASE';
      if (linked && (!dto.refId || dto.refModule !== ModuleCode.PURORD))
        throw new BadRequestException('구매오더를 선택하십시오.');
      if (!linked && (dto.refId || dto.refModule))
        throw new BadRequestException('해당 수불은 원본을 연결할 수 없습니다.');
      const source = linked
        ? await this.purchaseOrder(user, dto.refId!, manager)
        : null;
      if (source) {
        if (
          source.siteId !== dto.siteId ||
          source.items.length !== dto.items.length
        )
          throw new BadRequestException(
            '원본 사업장과 전체 품목·수량을 유지하십시오.',
          );
        if (
          await docs.existsBy({
            companyId: user.companyId,
            refModule: ModuleCode.PURORD,
            refId: dto.refId!,
            status: 'C',
            deleteYn: 'N',
          })
        )
          throw new ConflictException('이미 입고 확정한 구매오더입니다.');
      }
      let destination: Warehouse | null = null;
      if (movingOut) {
        if (!dto.toWarehouseId)
          throw new BadRequestException('수령 창고를 선택하십시오.');
        // 창고 키는 사업장+창고 복합키이므로 UI가 선택한 창고의 사업장을 함께 보낸다.
        destination = await manager.getRepository(Warehouse).findOneBy({
          companyId: user.companyId,
          siteId: dto.toSiteId ?? '',
          warehouseId: dto.toWarehouseId,
          deleteYn: 'N',
        });
        if (
          !destination ||
          (destination.siteId === dto.siteId &&
            destination.warehouseId === dto.warehouseId)
        )
          throw new BadRequestException(
            '같은 회사의 다른 수령 창고를 선택하십시오.',
          );
      }
      const seen = new Set<string>(),
        refs = new Set<string>(),
        items: InventoryItem[] = [];
      for (const [index, input] of dto.items.entries()) {
        const itemId = input.itemId ?? randomUUID();
        if (seen.has(itemId))
          throw new BadRequestException('중복 품목 ID입니다.');
        seen.add(itemId);
        const original = source?.items.find(
          (i) => i.refItemId === input.refItemId,
        );
        const quantity = decimal(
          original
            ? qty(input.quantity)
            : inputQuantity(input.quantity, dto.type === 'ADJUST'),
        );
        if (dto.type !== 'ADJUST' && qty(quantity, true) <= 0n)
          throw new BadRequestException('수량은 양수여야 합니다.');
        if (
          source &&
          (!original ||
            refs.has(original.refItemId) ||
            original.materialId !== input.materialId ||
            qty(original.quantity) !== qty(quantity))
        )
          throw new BadRequestException('원본 전체 품목·수량을 유지하십시오.');
        if (original) refs.add(original.refItemId);
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          deleteYn: 'N',
        });
        if (!material || (original && original.baseUnit !== material.baseUnit))
          throw new BadRequestException(
            '유효한 회사 자재·단위를 확인하십시오.',
          );
        if (
          original &&
          input.unitPrice !== undefined &&
          price(input.unitPrice) !== price(original.unitPrice)
        )
          throw new BadRequestException('원본 단가는 변경할 수 없습니다.');
        let unitPrice = '0',
          amount = '0';
        if (dto.type === 'ADJUST') {
          if (!/^-?\d{1,20}$/.test(input.amount ?? ''))
            throw new BadRequestException('조정 금액은 정수로 입력하십시오.');
          amount = BigInt(input.amount!).toString();
          if (qty(quantity, true) === 0n && amount === '0')
            throw new BadRequestException(
              '수량과 금액을 모두 0으로 조정할 수 없습니다.',
            );
        } else {
          if (input.amount !== undefined)
            throw new BadRequestException(
              '금액 직접 입력은 조정에서만 가능합니다.',
            );
          if (dto.type === 'IN') {
            unitPrice =
              original?.unitPrice ??
              decimal(inputPrice(input.unitPrice ?? '0'), 8);
            amount = rounded(
              qty(quantity) * price(unitPrice),
              100000000000000n,
            ).toString();
          }
        }
        items.push(
          Object.assign(new InventoryItem(), {
            companyId: user.companyId,
            inventoryDocumentId: id,
            itemId,
            sortOrder: index,
            materialId: material.materialId,
            materialName: original?.materialName ?? material.name,
            spec: original?.spec ?? material.spec,
            baseUnit: original?.baseUnit ?? material.baseUnit,
            quantity,
            unitPrice,
            amount,
            refItemId: original?.refItemId ?? null,
            note: input.note?.trim() || null,
          }),
        );
      }
      const row = docs.create({
        companyId: user.companyId,
        inventoryDocumentId: id,
        documentNo: dto.documentNo?.trim() ?? '',
        title: dto.title.trim(),
        type: dto.type,
        kind: dto.kind ?? null,
        postingDate: dto.postingDate,
        siteId: dto.siteId,
        warehouseId: dto.warehouseId,
        deptId: dto.deptId ?? user.deptId,
        toSiteId: destination?.siteId ?? null,
        toWarehouseId: destination?.warehouseId ?? null,
        refModule: linked ? ModuleCode.PURORD : null,
        refId: linked ? dto.refId : null,
        attachmentId: dto.attachmentId ?? null,
        reason: dto.reason?.trim() || null,
        note: dto.note?.trim() || null,
        status: 'C',
        deleteYn: 'N',
        postingSequence: await this.sequence(manager, user.companyId),
        createdBy: user.userId,
        confirmedBy: user.userId,
        confirmedAt: new Date(),
        cancelledBy: null,
        cancelledAt: null,
        cancelReason: null,
      });
      await this.stock.apply(manager, row, items);
      await docs.save(row);
      await manager.getRepository(InventoryItem).save(items);
      // 이동 입고는 출고와 함께 W로 저장한다. 수령 확정 전에는 도착 창고 잔고를 변경하지 않는다.
      if (destination && incomingId) {
        const incoming = docs.create(
          Object.assign({}, row, {
            inventoryDocumentId: incomingId,
            documentNo: '',
            type: 'IN',
            siteId: destination.siteId,
            warehouseId: destination.warehouseId,
            deptId: null,
            toSiteId: null,
            toWarehouseId: null,
            refModule: ModuleCode.INVDOC,
            refId: id,
            attachmentId: null,
            status: 'W',
            postingSequence: null,
            confirmedBy: null,
            confirmedAt: null,
          }),
        );
        await docs.save(incoming);
        await manager.getRepository(InventoryItem).save(
          items.map((i) =>
            Object.assign({}, i, {
              inventoryDocumentId: incomingId,
              itemId: randomUUID(),
              refItemId: i.itemId,
            }),
          ),
        );
      }
    });
    return this.get(user, id);
  }
  /** 이동 출고 때 보존한 수량·단가·금액 그대로 입고한다. 확정 시점에 순번만 새로 부여한다. */
  async confirm(user: UserContext, id: string, postingDate: string) {
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      const row = await this.get(user, id, manager);
      if (row.status !== 'W' || row.type !== 'IN' || row.kind !== 'TRANSFER')
        throw new ConflictException('수령 대기 입고만 확정할 수 있습니다.');
      this.assertSite(user, row.siteId);
      await this.warehouse(
        user.companyId,
        row.siteId,
        row.warehouseId,
        manager,
      );
      const source = await manager.getRepository(InventoryDocument).findOneBy({
        companyId: user.companyId,
        inventoryDocumentId: row.refId!,
        type: 'OUT',
        kind: 'TRANSFER',
        status: 'C',
        deleteYn: 'N',
      });
      if (!source) throw new ConflictException('유효한 원 출고가 없습니다.');
      if (postingDate < source.postingDate)
        throw new BadRequestException(
          '입고 전기일은 출고 전기일보다 빠를 수 없습니다.',
        );
      await this.openPeriod(user.companyId, postingDate, manager);
      row.status = 'C';
      row.postingDate = postingDate;
      row.postingSequence = await this.sequence(manager, user.companyId);
      row.confirmedBy = user.userId;
      row.confirmedAt = new Date();
      row.updatedBy = user.userId;
      row.updatedAt = new Date();
      await this.stock.apply(manager, row, row.items);
      const {
        items: _items,
        sourceSiteId: _site,
        sourceWarehouseId: _warehouse,
        ...header
      } = row;
      await manager.getRepository(InventoryDocument).save(header);
    });
    return this.get(user, id);
  }
  /** 회사 최신 확정순번부터 원금액으로 역반영한다. 확정 입고는 먼저 취소하고 대기 입고는 출고와 함께 취소한다. */
  async cancel(user: UserContext, id: string, reason: string) {
    if (!reason.trim())
      throw new BadRequestException('취소 사유를 입력하십시오.');
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      const row = await this.get(user, id, manager);
      if (row.status !== 'C')
        throw new ConflictException(
          '확정 전표만 취소할 수 있습니다. 대기 입고는 원 출고에서 함께 취소합니다.',
        );
      await this.openPeriod(user.companyId, row.postingDate, manager);
      const docs = manager.getRepository(InventoryDocument);
      const last = await docs.findOne({
        where: { companyId: user.companyId, status: 'C', deleteYn: 'N' },
        order: { postingSequence: 'DESC' },
      });
      if (last?.inventoryDocumentId !== id)
        throw new ConflictException(
          '회사 전체의 마지막 확정 전표부터 취소하십시오.',
        );
      const incoming =
        row.type === 'OUT' && row.kind === 'TRANSFER'
          ? await docs.findOneBy({
              companyId: user.companyId,
              type: 'IN',
              kind: 'TRANSFER',
              refModule: ModuleCode.INVDOC,
              refId: id,
              deleteYn: 'N',
            })
          : null;
      if (incoming?.status === 'C')
        throw new ConflictException('입고를 먼저 취소하십시오.');
      await this.stock.apply(manager, row, row.items, true);
      const cancelled = {
        status: 'X' as const,
        cancelledBy: user.userId,
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
        updatedBy: user.userId,
        updatedAt: new Date(),
      };
      await docs.update(
        { companyId: user.companyId, inventoryDocumentId: id },
        cancelled,
      );
      if (incoming?.status === 'W')
        await docs.update(
          {
            companyId: user.companyId,
            inventoryDocumentId: incoming.inventoryDocumentId,
          },
          cancelled,
        );
    });
    return this.get(user, id);
  }
}
