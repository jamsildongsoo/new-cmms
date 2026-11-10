/** 재고 거래의 저장·원본 참조·확정을 관리하고 확정 트랜잭션 안에서 재고를 재생한다. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { applyDocumentScope } from '../../common/utils/document-scope.util';
import { businessDate } from '../../common/utils/posting-date';
import {
  decimal,
  lineAmount,
  price,
  qty,
} from '../../common/utils/stock-decimal';
import { Warehouse } from '../../organization/warehouses/entities/warehouse.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Material } from '../material/entities/material.entity';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { PurchaseOrderService } from '../../purchase/purchase-order/purchase-order.service';
import { InventoryDocument } from './entities/inventory-document.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTypeRule } from './entities/inventory-type-rule.entity';
import { InventoryControl } from '../stock/entities/inventory-control.entity';
import { InventoryPeriodLock } from '../monthly-closing/entities/inventory-period-lock.entity';
import { StockInTransit } from '../stock/entities/stock-in-transit.entity';
import { SaveInventoryDto, InventorySearchDto } from './dto/inventory.dto';
import {
  STOCK_TYPE_DEFAULTS,
  STOCK_KINDS,
  StockKind,
} from '../stock/stock-engine';
import { StockProcessingService } from '../stock/stock-processing.service';
const CODE = 'INVENTORY_TRANSACTION_TYPE';
@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DataSource,
    private readonly purchases: PurchaseOrderService,
    private readonly stock: StockProcessingService,
  ) {}
  private scoped(user: UserContext, manager = this.db.manager) {
    return applyDocumentScope(
      manager.getRepository(InventoryDocument).createQueryBuilder('d'),
      user,
      'd',
    );
  }
  async list(user: UserContext, filter: InventorySearchDto = {}) {
    const q = this.scoped(user).orderBy('d.createdAt', 'DESC');
    if (filter.status)
      q.andWhere('d.status=:status', { status: filter.status });
    if (filter.typeCode)
      q.andWhere('d.typeCode=:typeCode', { typeCode: filter.typeCode });
    if (filter.siteId)
      q.andWhere('d.siteId=:siteId', { siteId: filter.siteId });
    if (filter.from)
      q.andWhere('d."postingDate" >= :from', {
        from: businessDate(filter.from),
      });
    if (filter.to)
      q.andWhere('d."postingDate" <= :to', { to: businessDate(filter.to) });
    return q.getMany();
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
    return Object.assign({}, row, { items });
  }
  private editable(user: UserContext, row: InventoryDocument) {
    if (row.status !== 'D' || row.createdBy !== user.userId)
      throw new ForbiddenException('작성자만 초안을 처리할 수 있습니다.');
  }
  private async departmentAllowed(
    user: UserContext,
    deptId: string | null,
    manager: EntityManager,
  ) {
    if (!user.deptId || !deptId) return false;
    const rows: { deptId: string }[] = await manager.query(
      `WITH RECURSIVE ds AS (SELECT "deptId" FROM department WHERE "companyId"=$1 AND "deptId"=$2 AND "deleteYn"='N' UNION SELECT d."deptId" FROM department d JOIN ds ON d."parentDeptId"=ds."deptId" WHERE d."companyId"=$1 AND d."deleteYn"='N') SELECT "deptId" FROM ds`,
      [user.companyId, user.deptId],
    );
    return rows.some((r) => r.deptId === deptId);
  }
  private async assertScope(
    user: UserContext,
    siteId: string,
    deptId: string | null,
    manager = this.db.manager,
  ) {
    if (user.accessScope === 'COMPANY_ALL') return;
    if (
      user.accessScope === 'OWN_SITE' &&
      user.siteId &&
      user.siteId === siteId
    )
      return;
    if (
      user.accessScope === 'OWN_DEPARTMENT' &&
      (await this.departmentAllowed(user, deptId, manager))
    )
      return;
    throw new ForbiddenException('문서 scope 밖입니다.');
  }
  private async warehouse(
    companyId: string,
    siteId: string,
    warehouseId: string,
    manager: EntityManager,
  ) {
    if (
      !siteId ||
      !warehouseId ||
      !(await manager
        .getRepository(Warehouse)
        .findOneBy({ companyId, siteId, warehouseId, deleteYn: 'N' }))
    )
      throw new BadRequestException(
        '같은 회사의 유효한 사업장·창고를 선택하십시오.',
      );
  }
  async initializeTypes(user: UserContext) {
    return this.db.transaction(async (manager) => {
      for (const [
        index,
        [typeCode, name, kind],
      ] of STOCK_TYPE_DEFAULTS.entries()) {
        if (
          !(await manager.getRepository(CodeItem).findOneBy({
            companyId: user.companyId,
            codeId: CODE,
            codeItemId: typeCode,
          }))
        )
          await manager.getRepository(CodeItem).save({
            companyId: user.companyId,
            codeId: CODE,
            codeItemId: typeCode,
            name,
            sortOrder: index,
          });
        if (
          !(await manager
            .getRepository(InventoryTypeRule)
            .findOneBy({ companyId: user.companyId, typeCode }))
        )
          await manager.getRepository(InventoryTypeRule).save({
            companyId: user.companyId,
            typeCode,
            processingKind: kind,
          });
      }
      return { message: '기본 수불유형을 등록했습니다.' };
    });
  }
  async options(user: UserContext) {
    this.scoped(user);
    const companyId = user.companyId;
    const [
      rules,
      codes,
      materials,
      sites,
      warehouses,
      departments,
      orders,
      periods,
    ] = await Promise.all([
      this.db.getRepository(InventoryTypeRule).find({ where: { companyId } }),
      this.db.getRepository(CodeItem).find({
        where: { companyId, codeId: CODE },
        order: { sortOrder: 'ASC' },
      }),
      this.db
        .getRepository(Material)
        .find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(Site).find({ where: { companyId, deleteYn: 'N' } }),
      this.db.getRepository(Warehouse).find({
        where: { companyId, deleteYn: 'N' },
        order: { siteId: 'ASC', warehouseId: 'ASC' },
      }),
      this.db
        .getRepository(Department)
        .find({ where: { companyId, deleteYn: 'N' } }),
      this.purchases.findAll(user, { status: 'C' }),
      this.db
        .getRepository(InventoryPeriodLock)
        .find({ where: { companyId }, order: { yearMonth: 'DESC' } }),
    ]);
    return {
      types: codes.flatMap((c) => {
        const r = rules.find((r) => r.typeCode === c.codeItemId);
        return r
          ? [{ value: r.typeCode, label: c.name, kind: r.processingKind }]
          : [];
      }),
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
      departments: departments.map((d) => ({ value: d.deptId, label: d.name })),
      orders: orders.map((o) => ({
        orderId: o.orderId,
        documentNo: o.documentNo,
        title: o.title,
      })),
      periods,
      transfers: await this.incoming(user),
    };
  }
  async incoming(user: UserContext) {
    const rows = await this.db.getRepository(StockInTransit).find({
      where: { companyId: user.companyId, receivedDocumentId: IsNull() },
    });
    const visible: StockInTransit[] = [];
    for (const row of rows) {
      try {
        await this.assertScope(user, row.toSiteId, row.toDeptId);
        visible.push(row);
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }
    const ids = [...new Set(visible.map((t) => t.outDocumentId))];
    const docs: InventoryDocument[] = [];
    for (const id of ids) {
      const d = await this.db.getRepository(InventoryDocument).findOneBy({
        companyId: user.companyId,
        inventoryDocumentId: id,
        status: 'C',
        deleteYn: 'N',
      });
      if (d) docs.push(d);
    }
    return docs.map((d) => ({
      inventoryDocumentId: d.inventoryDocumentId,
      documentNo: d.documentNo,
      title: d.title,
      toSiteId: d.toSiteId,
      toWarehouseId: d.toWarehouseId,
      toDeptId: d.toDeptId,
    }));
  }
  async reference(
    user: UserContext,
    module: string,
    id: string,
    manager = this.db.manager,
  ) {
    if (module === 'purchase_order') {
      const order = await this.purchases.findOne(user, id, manager);
      if (order.status !== 'C' || !order.items.length)
        throw new BadRequestException('완결 발주만 입고할 수 있습니다.');
      return {
        referenceNo: order.orderId,
        title: order.title,
        items: order.items.map((i) => ({
          refItemId: i.itemId,
          materialId: i.materialId,
          materialName: i.materialName,
          spec: i.spec,
          baseUnit: i.baseUnit,
          quantity: i.quantity,
          unitPrice: i.unitPrice ?? '0',
        })),
        toSiteId: null as string | null,
        toWarehouseId: null as string | null,
        toDeptId: null as string | null,
        postingDate: null as string | null,
      };
    }
    if (module !== 'inventory_document')
      throw new BadRequestException('잘못된 참조 모듈입니다.');
    const source = await manager.getRepository(InventoryDocument).findOneBy({
      companyId: user.companyId,
      inventoryDocumentId: id,
      status: 'C',
      processingKind: 'SITE_OUT',
      deleteYn: 'N',
    });
    if (!source?.toSiteId || !source.toWarehouseId)
      throw new NotFoundException('확정 타사업장출고가 없습니다.');
    await this.assertScope(user, source.toSiteId, source.toDeptId, manager);
    const transits = await manager
      .getRepository(StockInTransit)
      .find({ where: { companyId: user.companyId, outDocumentId: id } });
    if (!transits.length || transits.some((t) => t.receivedDocumentId))
      throw new ConflictException('이미 입고되었거나 이동 내역이 없습니다.');
    const sourceItems = await manager.getRepository(InventoryItem).find({
      where: { companyId: user.companyId, inventoryDocumentId: id },
      order: { sortOrder: 'ASC' },
    });
    return {
      referenceNo: source.inventoryDocumentId,
      title: source.title,
      items: sourceItems.map((i) => ({
        refItemId: i.itemId,
        materialId: i.materialId,
        materialName: i.materialName,
        spec: i.spec,
        baseUnit: i.baseUnit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      toSiteId: source.toSiteId,
      toWarehouseId: source.toWarehouseId,
      toDeptId: source.toDeptId,
      postingDate: source.postingDate,
    };
  }
  async save(user: UserContext, dto: SaveInventoryDto, id?: string) {
    const targetId = id ?? dto.inventoryDocumentId;
    if (!targetId)
      throw new BadRequestException('서버 채번 문서 ID가 필요합니다.');
    await this.db.transaction(async (manager) => {
      const old = id ? await this.get(user, id, manager) : null;
      if (old) this.editable(user, old);
      else if (
        await manager.getRepository(InventoryDocument).findOneBy({
          companyId: user.companyId,
          inventoryDocumentId: targetId,
        })
      )
        throw new ConflictException('중복 문서 ID입니다.');
      const deptId = dto.deptId ?? user.deptId;
      await this.assertScope(user, dto.siteId, deptId, manager);
      await this.warehouse(
        user.companyId,
        dto.siteId,
        dto.warehouseId,
        manager,
      );
      businessDate(dto.postingDate);
      const rule = await manager
        .getRepository(InventoryTypeRule)
        .findOneBy({ companyId: user.companyId, typeCode: dto.typeCode });
      if (
        !rule ||
        !STOCK_KINDS.includes(rule.processingKind as StockKind) ||
        !(await manager.getRepository(CodeItem).findOneBy({
          companyId: user.companyId,
          codeId: CODE,
          codeItemId: dto.typeCode,
        }))
      )
        throw new BadRequestException('수불 유형 설정을 확인하십시오.');
      const kind = rule.processingKind;
      if (kind === 'TRANSFER' || kind === 'SITE_OUT') {
        await this.warehouse(
          user.companyId,
          dto.toSiteId ?? '',
          dto.toWarehouseId ?? '',
          manager,
        );
        if (
          (kind === 'TRANSFER' &&
            (dto.siteId !== dto.toSiteId ||
              dto.warehouseId === dto.toWarehouseId)) ||
          (kind === 'SITE_OUT' && dto.siteId === dto.toSiteId)
        )
          throw new BadRequestException(
            '이동 유형과 목적 사업장·창고가 일치하지 않습니다.',
          );
      }
      const linked = kind === 'PURCHASE_IN' || kind === 'SITE_IN';
      if (
        linked &&
        (!dto.refId ||
          dto.refModule !==
            (kind === 'PURCHASE_IN' ? 'purchase_order' : 'inventory_document'))
      )
        throw new BadRequestException('원 발주 또는 출고를 선택하십시오.');
      if (!linked && (dto.refId || dto.refModule))
        throw new BadRequestException(
          '일반 수불에는 구매/이동 원본을 연결할 수 없습니다.',
        );
      const source = linked
        ? await this.reference(user, dto.refModule!, dto.refId!, manager)
        : null;
      if (source && source.items.length !== dto.items.length)
        throw new BadRequestException('부분 입고는 허용되지 않습니다.');
      if (
        kind === 'SITE_IN' &&
        source &&
        (source.toSiteId !== dto.siteId ||
          source.toWarehouseId !== dto.warehouseId ||
          dto.postingDate < source.postingDate!)
      )
        throw new BadRequestException(
          '도착 사업장·창고 또는 posting date를 확인하십시오.',
        );
      const items: InventoryItem[] = [],
        seen = new Set<string>(),
        sourceSeen = new Set<string>();
      for (const [index, input] of dto.items.entries()) {
        const itemId = input.itemId ?? randomUUID();
        if (seen.has(itemId))
          throw new BadRequestException('중복 품목 ID입니다.');
        seen.add(itemId);
        const quantity = decimal(qty(input.quantity, kind === 'ADJUST'));
        if (
          qty(quantity, true) === 0n ||
          (kind !== 'ADJUST' && qty(quantity, true) < 0n)
        )
          throw new BadRequestException('유효한 수량을 입력하십시오.');
        const original = source?.items.find(
          (s) => s.refItemId === input.refItemId,
        );
        if (
          source &&
          (!original ||
            sourceSeen.has(original.refItemId) ||
            original.materialId !== input.materialId ||
            qty(original.quantity) !== qty(quantity, true))
        )
          throw new BadRequestException(
            '원본의 전체 품목·수량을 유지하십시오.',
          );
        if (original) sourceSeen.add(original.refItemId);
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: input.materialId,
          deleteYn: 'N',
        });
        if (!material)
          throw new BadRequestException('유효한 회사 자재를 선택하십시오.');
        if (original && original.baseUnit !== material.baseUnit)
          throw new BadRequestException('원 자재 단위가 변경되었습니다.');
        const receipt =
          kind === 'GENERAL_IN' ||
          kind === 'PURCHASE_IN' ||
          kind === 'SITE_IN' ||
          (kind === 'ADJUST' && qty(quantity, true) > 0n);
        const unitPrice =
          original?.unitPrice ??
          (receipt ? decimal(price(input.unitPrice ?? '0'), 8) : '0');
        if (
          original &&
          input.unitPrice !== undefined &&
          price(input.unitPrice) !== price(original.unitPrice)
        )
          throw new BadRequestException('원본 단가는 변경할 수 없습니다.');
        items.push(
          Object.assign(new InventoryItem(), {
            companyId: user.companyId,
            inventoryDocumentId: targetId,
            itemId,
            sortOrder: index,
            materialId: material.materialId,
            materialName: original?.materialName ?? material.name,
            spec: original?.spec ?? material.spec,
            baseUnit: original?.baseUnit ?? material.baseUnit,
            quantity,
            unitPrice,
            amount:
              receipt && qty(quantity, true) > 0n
                ? lineAmount(quantity, unitPrice)
                : '0',
            refItemId: original?.refItemId ?? null,
            note: input.note?.trim() || null,
          }),
        );
      }
      if (!dto.title.trim())
        throw new BadRequestException('전표명을 입력하십시오.');
      const row = Object.assign(new InventoryDocument(), old ?? {}, {
        companyId: user.companyId,
        inventoryDocumentId: targetId,
        documentNo: dto.documentNo?.trim() ?? '',
        title: dto.title.trim(),
        typeCode: dto.typeCode,
        processingKind: kind,
        postingDate: dto.postingDate,
        siteId: dto.siteId,
        warehouseId: dto.warehouseId,
        deptId: kind === 'SITE_IN' ? source!.toDeptId : deptId,
        toSiteId: dto.toSiteId ?? null,
        toWarehouseId: dto.toWarehouseId ?? null,
        toDeptId: dto.toDeptId ?? null,
        refModule: linked ? dto.refModule : null,
        refId: linked ? dto.refId : null,
        referenceNo: source?.referenceNo ?? null,
        reason: dto.reason?.trim() || null,
        note: dto.note?.trim() || null,
        attachmentId: dto.attachmentId ?? null,
        status: 'D',
        deleteYn: 'N',
        createdBy: old?.createdBy ?? user.userId,
      });
      if (old) {
        row.updatedBy = user.userId;
        row.updatedAt = new Date();
      }
      await manager.getRepository(InventoryDocument).save(row);
      await manager
        .getRepository(InventoryItem)
        .delete({ companyId: user.companyId, inventoryDocumentId: targetId });
      if (items.length) await manager.getRepository(InventoryItem).save(items);
    });
    return this.get(user, targetId);
  }
  async remove(user: UserContext, id: string) {
    const row = await this.get(user, id);
    this.editable(user, row);
    await this.db
      .getRepository(InventoryDocument)
      .update(
        { companyId: user.companyId, inventoryDocumentId: id },
        { deleteYn: 'Y', updatedBy: user.userId, updatedAt: new Date() },
      );
    return row;
  }
  async confirm(user: UserContext, id: string) {
    await this.db.transaction(async (manager) => {
      await this.stock.companyLock(manager, user.companyId);
      const row = await this.get(user, id, manager);
      if (row.status === 'C') return;
      this.editable(user, row);
      const period = await manager
        .getRepository(InventoryPeriodLock)
        .findOneBy({
          companyId: user.companyId,
          yearMonth: row.postingDate.slice(0, 6),
        });
      if (!period || period.locked)
        throw new ConflictException(
          'Posting 월이 Open되지 않았거나 마감되었습니다.',
        );
      if (!row.items.length)
        throw new BadRequestException('품목을 입력하십시오.');
      if (row.processingKind === 'ADJUST' && !row.reason)
        throw new BadRequestException('조정 사유를 입력하십시오.');
      if (row.refModule && row.refId) {
        const source = await this.reference(
          user,
          row.refModule,
          row.refId,
          manager,
        );
        if (
          source.items.length !== row.items.length ||
          source.items.some(
            (s) =>
              !row.items.some(
                (i) =>
                  i.refItemId === s.refItemId &&
                  i.materialId === s.materialId &&
                  qty(i.quantity) === qty(s.quantity),
              ),
          )
        )
          throw new ConflictException('원본 전체 수량과 일치하지 않습니다.');
        const duplicate = await manager
          .getRepository(InventoryDocument)
          .findOneBy({
            companyId: user.companyId,
            refModule: row.refModule,
            refId: row.refId,
            status: 'C',
            deleteYn: 'N',
          });
        if (duplicate)
          throw new ConflictException('이미 입고 확정한 원본입니다.');
      }
      await this.warehouse(
        user.companyId,
        row.siteId,
        row.warehouseId,
        manager,
      );
      if (row.toSiteId && row.toWarehouseId)
        await this.warehouse(
          user.companyId,
          row.toSiteId,
          row.toWarehouseId,
          manager,
        );
      for (const item of row.items) {
        const material = await manager.getRepository(Material).findOneBy({
          companyId: user.companyId,
          materialId: item.materialId,
          deleteYn: 'N',
        });
        if (!material || material.baseUnit !== item.baseUnit)
          throw new BadRequestException('자재 또는 기본단위가 변경되었습니다.');
      }
      let control = await manager
        .getRepository(InventoryControl)
        .findOneBy({ companyId: user.companyId });
      if (!control)
        control = Object.assign(new InventoryControl(), {
          companyId: user.companyId,
          lastSequence: '0',
        });
      control.lastSequence = (BigInt(control.lastSequence) + 1n).toString();
      await manager.getRepository(InventoryControl).save(control);
      await manager.getRepository(InventoryDocument).update(
        { companyId: user.companyId, inventoryDocumentId: id },
        {
          status: 'C',
          postingSequence: control.lastSequence,
          updatedBy: user.userId,
          updatedAt: new Date(),
        },
      );
      await this.stock.rebuild(manager, user.companyId);
      await manager
        .getRepository(InventoryPeriodLock)
        .createQueryBuilder()
        .update()
        .set({ summaryDirty: true })
        .where('"companyId"=:companyId', { companyId: user.companyId })
        .andWhere('"yearMonth">=:month', { month: period.yearMonth })
        .execute();
    });
    return this.get(user, id);
  }
}
