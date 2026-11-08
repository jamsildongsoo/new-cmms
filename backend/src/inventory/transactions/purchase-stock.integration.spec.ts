import { Test } from '@nestjs/testing';
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { NumberingService } from '../../numbering/numbering.service';
import { NumberSequence } from '../../numbering/entities/number-sequence.entity';
import { DocumentRequest } from '../../numbering/entities/document-request.entity';
import { Attachment } from '../../attachments/entities/attachment.entity';
import { PurchaseRequestController } from '../../purchase/purchase-request/purchase-request.controller';
import { PurchaseRequestService } from '../../purchase/purchase-request/purchase-request.service';
import { PurchaseOrderController } from '../../purchase/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../../purchase/purchase-order/purchase-order.service';
import { InventoryController } from './inventory.controller';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../../test/support/pglite';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { Department } from '../../organization/departments/entities/department.entity';
import { Warehouse } from '../../organization/warehouses/entities/warehouse.entity';
import { User } from '../../identity/users/entities/user.entity';
import { Material } from '../material/entities/material.entity';
import { MaterialService } from '../material/material.service';
import { CodeValidationService } from '../../codes/code-validation.service';
import { PurchaseRequest } from '../../purchase/purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../../purchase/purchase-order/entities/purchase-order.entity';
import { PurchaseRequestItem } from '../../purchase/common/purchase-request-item.entity';
import { PurchaseOrderItem } from '../../purchase/common/purchase-order-item.entity';
import { PurchaseOrderAllocation } from '../../purchase/common/purchase-order-allocation.entity';
import { PurchaseService } from '../../purchase/common/purchase.service';
import { Vendor } from '../../purchase/vendor/entities/vendor.entity';
import { VendorService } from '../../purchase/vendor/vendor.service';
import { InventoryService } from './inventory.service';
import { SaveInventoryDto } from './dto/inventory.dto';
import * as inventoryEntities from './entities/inventory.entity';

jest.setTimeout(90000);
const actor = {
  companyId: 'TEST',
  userId: 'owner',
  siteId: 'S1',
  deptId: 'D1',
  roleId: 'ADMIN',
  accessScope: 'COMPANY_ALL',
  permissions: [],
} as UserContext;
let db: DataSource,
  purchases: PurchaseService,
  inventory: InventoryService,
  dispose: () => Promise<void>;
const entities = [
  NumberSequence,
  DocumentRequest,
  Attachment,
  Site,
  Department,
  Warehouse,
  User,
  Material,
  CodeItem,
  PurchaseRequest,
  PurchaseOrder,
  PurchaseRequestItem,
  PurchaseOrderItem,
  PurchaseOrderAllocation,
  Vendor,
  ...Object.values(inventoryEntities),
];
beforeAll(async () => {
  const fixture = await postgresTestDatabase(entities);
  db = fixture.dataSource;
  dispose = fixture.close;
  purchases = new PurchaseService(db);
  inventory = new InventoryService(db, purchases);
});
afterAll(async () => {
  if (dispose) await dispose();
});
beforeEach(async () => {
  for (const entity of [...entities].reverse())
    await db.getRepository(entity).createQueryBuilder().delete().execute();
  for (const siteId of ['S1', 'S2'])
    await db.getRepository(Site).save({
      companyId: actor.companyId,
      siteId,
      name: siteId,
      deleteYn: 'N',
      createdBy: 'owner',
    });
  for (const deptId of ['D1', 'D2'])
    await db.getRepository(Department).save({
      companyId: actor.companyId,
      deptId,
      name: deptId,
      parentDeptId: null,
      deleteYn: 'N',
      createdBy: 'owner',
    });
  for (const [siteId, warehouseId] of [
    ['S1', 'W1'],
    ['S1', 'W2'],
    ['S2', 'W1'],
  ])
    await db.getRepository(Warehouse).save({
      companyId: actor.companyId,
      siteId,
      warehouseId,
      name: warehouseId,
      deleteYn: 'N',
      createdBy: 'owner',
    });
  await db.getRepository(Material).save({
    companyId: actor.companyId,
    materialId: 'M1',
    name: '베어링',
    typeCode: 'PART',
    baseUnit: 'EA',
    spec: '6205',
    maker: null,
    model: null,
    note: null,
    attachmentId: null,
    deleteYn: 'N',
    createdBy: 'owner',
  });
  await inventory.initializeTypes(actor);
});
async function stock(
  kind: string,
  quantity: string,
  unitPrice = '10',
  overrides: Partial<SaveInventoryDto> = {},
  user = actor,
) {
  return inventory.save(user, {
    inventoryDocumentId: await new NumberingService(db).generateDocumentId(
      user.companyId,
      'inventory_document',
    ),
    title: kind,
    documentNo: '',
    typeCode: kind,
    postingDate: '20260301',
    siteId: 'S1',
    warehouseId: 'W1',
    deptId: 'D1',
    reason: '실사',
    items: [{ itemId: randomUUID(), materialId: 'M1', quantity, unitPrice }],
    ...overrides,
  });
}
async function post(
  kind: string,
  q: string,
  p = '10',
  overrides: Partial<SaveInventoryDto> = {},
  user = actor,
) {
  const d = await stock(kind, q, p, overrides, user);
  return inventory.confirm(user, d.inventoryDocumentId);
}
async function approvedRequest(quantity: string) {
  const id = randomUUID();
  await purchases.save(
    'request',
    actor,
    id,
    {
      title: '구매요청',
      requestDate: '20260301',
      items: [{ itemId: randomUUID(), materialId: 'M1', quantity }],
    },
    true,
  );
  await purchases.assertCanSubmit('request', actor, id);
  await purchases.sync('request', actor.companyId, id, 'P', 'owner');
  await purchases.sync('request', actor.companyId, id, 'C', 'manager');
  return purchases.get('request', actor, id);
}

describe('Purchase and inventory SQL integration', () => {
  it('rejects repeated document UUID creation without changing the saved document', async () => {
    const id = randomUUID();
    await purchases.save(
      'request',
      actor,
      id,
      { title: '원본', items: [] },
      true,
    );
    await expect(
      purchases.save(
        'request',
        actor,
        id,
        { title: '덮어쓰기 시도', items: [] },
        true,
      ),
    ).rejects.toThrow('이미 존재');
    expect((await purchases.get('request', actor, id)).title).toBe('원본');
  });
  it('manages company-wide vendors with audit fields, pagination and soft deletion', async () => {
    const vendors = new VendorService(db.getRepository(Vendor));
    const other = { ...actor, companyId: 'OTHER' };
    const created = await vendors.create(actor, {
      vendorId: 'V1',
      name: '공급업체',
      registrationNo: '123-45-67890',
    });
    expect(created).toMatchObject({
      companyId: actor.companyId,
      createdBy: 'owner',
      deleteYn: 'N',
    });
    await vendors.create(other, { vendorId: 'V1', name: '다른 회사 벤더' });
    expect(
      (await vendors.list(actor, { search: '67890', page: 1, limit: 1 })).total,
    ).toBe(1);
    await expect(vendors.get(other, 'MISSING')).rejects.toThrow();
    const manager = { ...actor, userId: 'manager' };
    const updated = await vendors.update(manager, 'V1', {
      name: '새 벤더명',
      phone: '02-1234-5678',
    });
    expect(updated.updatedBy).toBe('manager');
    expect(updated.registrationNo).toBe('123-45-67890');
    expect(
      (await vendors.update(manager, 'V1', { phone: '02-9999-9999' })).name,
    ).toBe('새 벤더명');
    await expect(
      vendors.update(manager, 'V1', { name: '  ' }),
    ).rejects.toThrow();
    await vendors.remove(manager, 'V1');
    expect((await vendors.list(actor)).total).toBe(0);
    expect((await vendors.get(other, 'V1')).name).toBe('다른 회사 벤더');
    await expect(
      vendors.create(actor, { vendorId: 'V1', name: '번호 재사용' }),
    ).rejects.toThrow();
    await expect(vendors.get(actor, 'V1')).rejects.toThrow();
  });
  it('selects a same-company vendor and preserves order snapshots after vendor edits and deletion', async () => {
    const vendors = new VendorService(db.getRepository(Vendor));
    await vendors.create(actor, {
      vendorId: 'V1',
      name: '최초 공급처',
      contactName: '원 담당자',
      phone: '111',
    });
    const id = randomUUID();
    const dto = {
      title: '벤더 발주',
      vendorId: 'V1',
      supplierName: '입력값',
      orderDate: '20260301',
      items: [{ materialId: 'M1', quantity: '2', unitPrice: '10' }],
    };
    const order = await purchases.save('order', actor, id, dto, true);
    expect(order).toMatchObject({
      vendorId: 'V1',
      supplierName: '최초 공급처',
      supplierContactName: '원 담당자',
      supplierPhone: '111',
    });
    await vendors.update(actor, 'V1', { name: '변경 공급처', phone: '222' });
    await vendors.remove(actor, 'V1');
    const saved = await purchases.save(
      'order',
      actor,
      id,
      {
        ...dto,
        supplierName: order.supplierName,
        supplierContactName: order.supplierContactName,
        supplierPhone: order.supplierPhone,
      },
      false,
    );
    expect(saved).toMatchObject({
      vendorId: 'V1',
      supplierName: '최초 공급처',
      supplierPhone: '111',
    });
    await purchases.assertCanSubmit('order', actor, id);
    expect((await purchases.options('order', actor)).vendors).toHaveLength(0);
    await expect(
      purchases.save('order', actor, randomUUID(), dto, true),
    ).rejects.toThrow('벤더');
    await vendors.create(
      { ...actor, companyId: 'OTHER' },
      { vendorId: 'V2', name: '다른 회사' },
    );
    await expect(
      purchases.save(
        'order',
        actor,
        randomUUID(),
        { ...dto, vendorId: 'V2' },
        true,
      ),
    ).rejects.toThrow('벤더');
  });
  it('stores requests without monetary fields and starts order pricing independently', async () => {
    const request = await approvedRequest('2');
    expect(request).not.toHaveProperty('totalAmount');
    expect(request.items[0]).not.toHaveProperty('unitPrice');
    expect(request.items[0]).not.toHaveProperty('amount');
    const preview = await purchases.preview(actor, [request.requestId]);
    expect(preview.items[0]).toMatchObject({
      quantity: '2',
      unitPrice: null,
      amount: null,
    });
  });
  it('maps receipt cancellation code to an ordinary issue without changing the original receipt', async () => {
    await inventory.periodAction(actor, '202603', 'open');
    const receipt = await post('GENERAL_IN', '4', '10');
    const options = await inventory.options(actor);
    expect(
      options.types.find((t) => t.value === 'RECEIPT_CANCEL_OUT'),
    ).toMatchObject({ kind: 'GENERAL_OUT' });
    const cancellation = await post('RECEIPT_CANCEL_OUT', '4', '0', {
      postingDate: '20260302',
    });
    expect(cancellation.processingKind).toBe('GENERAL_OUT');
    expect(
      (await inventory.get(actor, receipt.inventoryDocumentId)).status,
    ).toBe('C');
    expect((await inventory.balances(actor)).sites[0]).toMatchObject({
      quantity: '0.000000',
      amount: '0',
    });
    await expect(post('RECEIPT_CANCEL_OUT', '1', '0')).rejects.toThrow();
  });
  it('keeps documents tenant-bound, owner-only while draft, and immutable after posting', async () => {
    await inventory.periodAction(actor, '202603', 'open');
    const draft = await stock('GENERAL_IN', '3');
    const otherCompany = { ...actor, companyId: 'OTHER' };
    const otherOwner = { ...actor, userId: 'other' };
    expect(await inventory.list(otherCompany)).toEqual([]);
    await expect(
      inventory.get(otherCompany, draft.inventoryDocumentId),
    ).rejects.toThrow();
    await expect(
      inventory.confirm(otherOwner, draft.inventoryDocumentId),
    ).rejects.toThrow();
    await expect(
      inventory.remove(otherOwner, draft.inventoryDocumentId),
    ).rejects.toThrow();
    await inventory.confirm(actor, draft.inventoryDocumentId);
    await inventory.confirm(actor, draft.inventoryDocumentId);
    expect((await inventory.balances(actor)).sites[0].quantity).toBe(
      '3.000000',
    );
    await expect(
      inventory.remove(actor, draft.inventoryDocumentId),
    ).rejects.toThrow();
    await inventory.periodAction(actor, '202603', 'close');
    const blocked = await stock('GENERAL_IN', '2');
    await expect(
      inventory.confirm(actor, blocked.inventoryDocumentId),
    ).rejects.toThrow();
    expect(
      (await inventory.get(actor, blocked.inventoryDocumentId)).status,
    ).toBe('D');
    expect((await inventory.balances(actor)).sites[0].quantity).toBe(
      '3.000000',
    );
  });
  it('blocks base-unit changes after stock history while allowing other master edits', async () => {
    const materials = new MaterialService(
      db.getRepository(Material),
      {} as CodeValidationService,
    );
    await materials.update(actor, 'M1', { baseUnit: 'BOX' });
    await materials.update(actor, 'M1', { baseUnit: 'EA' });
    await inventory.periodAction(actor, '202603', 'open');
    await post('GENERAL_IN', '2');
    await expect(
      materials.update(actor, 'M1', { baseUnit: 'BOX' }),
    ).rejects.toThrow('기본 단위');
    await materials.update(actor, 'M1', { name: '변경된 명칭' });
    expect((await inventory.list(actor))[0].status).toBe('C');
  });
  it('blocks base-unit changes after approved purchasing history', async () => {
    const materials = new MaterialService(
      db.getRepository(Material),
      {} as CodeValidationService,
    );
    await approvedRequest('2');
    await expect(
      materials.update(actor, 'M1', { baseUnit: 'BOX' }),
    ).rejects.toThrow('기본 단위');
  });
  it('merges complete requests, persists allocations, warns without blocking a second order, and rejects quantity changes', async () => {
    const a = await approvedRequest('10'),
      b = await approvedRequest('5');
    const ids = [a.requestId, b.requestId];
    const preview = await purchases.preview(actor, ids);
    expect(preview.items[0].quantity).toBe('15');
    expect(preview.hasLinkedOrders).toBe(false);
    const dto = {
      title: '병합 발주',
      orderDate: '20260302',
      supplierName: '공급처',
      requestIds: ids,
      items: preview.items.map((i) => ({
        itemId: randomUUID(),
        materialId: i.materialId,
        quantity: i.quantity,
        unitPrice: '12',
      })),
    };
    const id = randomUUID(),
      saved = await purchases.save('order', actor, id, dto, true);
    expect(saved.allocations.map((a) => a.quantity).sort()).toEqual([
      '10.000000',
      '5.000000',
    ]);
    expect(saved.totalAmount).toBe('180');
    expect((await purchases.preview(actor, ids)).message).toContain(
      '기존 연결',
    );
    await purchases.save('order', actor, randomUUID(), dto, true);
    await expect(
      purchases.save(
        'order',
        actor,
        randomUUID(),
        { ...dto, items: [{ ...dto.items[0], quantity: '14' }] },
        true,
      ),
    ).rejects.toThrow('수량');
    await expect(
      purchases.get('request', { ...actor, companyId: 'OTHER' }, a.requestId),
    ).rejects.toThrow();
    await expect(
      purchases.save('order', { ...actor, userId: 'other' }, id, dto, false),
    ).rejects.toThrow('작성자');
  });
  it('supports standalone orders, full PO receipt, exact source prices, and duplicate/partial receipt rejection', async () => {
    const orderId = randomUUID();
    await purchases.save(
      'order',
      actor,
      orderId,
      {
        title: '단독 발주',
        documentNo: 'PO-01',
        orderDate: '20260301',
        supplierName: '공급처',
        items: [
          {
            itemId: randomUUID(),
            materialId: 'M1',
            quantity: '10',
            unitPrice: '12',
          },
        ],
      },
      true,
    );
    await purchases.assertCanSubmit('order', actor, orderId);
    await purchases.sync('order', actor.companyId, orderId, 'P', 'owner');
    await purchases.sync('order', actor.companyId, orderId, 'C', 'manager');
    const ref = await inventory.reference(actor, 'purchase_order', orderId);
    await inventory.periodAction(actor, '202603', 'open');
    const items = ref.items.map((i) => ({
      itemId: randomUUID(),
      materialId: i.materialId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      refItemId: i.refItemId,
    }));
    const row = await stock('PURCHASE_IN', '10', '12', {
      refModule: 'purchase_order',
      refId: orderId,
      items,
    });
    expect(row.referenceNo).toBe(orderId);
    await expect(
      stock('PURCHASE_IN', '9', '12', {
        refModule: 'purchase_order',
        refId: orderId,
        items: [{ ...items[0], quantity: '9' }],
      }),
    ).rejects.toThrow('수량');
    await inventory.confirm(actor, row.inventoryDocumentId);
    expect((await inventory.balances(actor)).sites[0]).toMatchObject({
      quantity: '10.000000',
      amount: '120',
    });
    const duplicate = await stock('PURCHASE_IN', '10', '12', {
      refModule: 'purchase_order',
      refId: orderId,
      items,
    });
    await expect(
      inventory.confirm(actor, duplicate.inventoryDocumentId),
    ).rejects.toThrow('이미 입고');
    expect((await inventory.balances(actor)).sites[0].amount).toBe('120');
  });
  it('uses multiple open months, posting-date valuation, warehouse-only transfers and transaction rollback', async () => {
    await inventory.periodAction(actor, '202603', 'open');
    await inventory.periodAction(actor, '202604', 'open');
    await post('GENERAL_IN', '10', '10');
    await post('GENERAL_IN', '10', '30', { warehouseId: 'W2' });
    await post('TRANSFER', '3', '0', {
      toSiteId: 'S1',
      toWarehouseId: 'W2',
      postingDate: '20260302',
    });
    await post('GENERAL_OUT', '2', '0', { postingDate: '20260402' });
    const balances = await inventory.balances(actor);
    expect(balances.sites[0]).toMatchObject({
      quantity: '18.000000',
      amount: '360',
      averagePrice: '20.00000000',
    });
    const shortage = await stock('GENERAL_OUT', '999', '0');
    await expect(
      inventory.confirm(actor, shortage.inventoryDocumentId),
    ).rejects.toThrow('부족');
    expect(
      (await inventory.get(actor, shortage.inventoryDocumentId)).status,
    ).toBe('D');
    expect((await inventory.balances(actor)).sites[0].amount).toBe('360');
    const march = await inventory.periodAction(actor, '202603', 'close');
    expect(march.sites[0]).toMatchObject({
      openingQuantity: '0.000000',
      closingQuantity: '20.000000',
      closingAmount: '400',
    });
    const locked = await stock('GENERAL_IN', '1', '5');
    await expect(
      inventory.confirm(actor, locked.inventoryDocumentId),
    ).rejects.toThrow('마감');
    const april = await inventory.periodAction(actor, '202604', 'close');
    expect(april.sites[0]).toMatchObject({
      openingQuantity: '20.000000',
      openingAmount: '400',
      closingQuantity: '18.000000',
      closingAmount: '360',
    });
  });
  it('separates cross-site dispatch and receipt by destination scope and carries transit over month end', async () => {
    await inventory.periodAction(actor, '202603', 'open');
    await inventory.periodAction(actor, '202604', 'open');
    await post('GENERAL_IN', '10', '10');
    const sender = {
      ...actor,
      accessScope: 'OWN_SITE',
      siteId: 'S1',
    } as UserContext;
    const out = await post(
      'SITE_OUT',
      '4',
      '0',
      {
        toSiteId: 'S2',
        toWarehouseId: 'W1',
        toDeptId: 'D2',
        postingDate: '20260331',
      },
      sender,
    );
    const receiver = {
      ...actor,
      userId: 'receiver',
      accessScope: 'OWN_SITE',
      siteId: 'S2',
      deptId: 'D2',
    } as UserContext;
    expect((await inventory.incoming(receiver)).length).toBe(1);
    await expect(
      inventory.get(receiver, out.inventoryDocumentId),
    ).rejects.toThrow();
    await expect(
      inventory.reference(
        sender,
        'inventory_document',
        out.inventoryDocumentId,
      ),
    ).rejects.toThrow('scope');
    const march = await inventory.periodAction(actor, '202603', 'close');
    expect(march.transits[0]).toMatchObject({
      closingQuantity: '4.000000',
      closingAmount: '40',
    });
    const ref = await inventory.reference(
      receiver,
      'inventory_document',
      out.inventoryDocumentId,
    );
    const items = ref.items.map((i) => ({
      itemId: randomUUID(),
      materialId: i.materialId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      refItemId: i.refItemId,
    }));
    await post(
      'SITE_IN',
      '4',
      '10',
      {
        siteId: 'S2',
        warehouseId: 'W1',
        deptId: 'D2',
        postingDate: '20260402',
        refModule: 'inventory_document',
        refId: out.inventoryDocumentId,
        items,
      },
      receiver,
    );
    expect((await inventory.incoming(receiver)).length).toBe(0);
    const april = await inventory.periodAction(actor, '202604', 'close');
    expect(april.sites.find((s) => s.siteId === 'S2')).toMatchObject({
      closingQuantity: '4.000000',
      closingAmount: '40',
    });
    expect(april.transits[0]).toMatchObject({
      openingQuantity: '4.000000',
      receivedQuantity: '4.000000',
      closingQuantity: '0.000000',
    });
  });
  it('unlocks a closed month, revalues later issues and regenerates opening balances in sequence', async () => {
    await inventory.periodAction(actor, '202603', 'open');
    await inventory.periodAction(actor, '202604', 'open');
    await post('GENERAL_IN', '10', '10');
    await post('GENERAL_OUT', '5', '0', { postingDate: '20260402' });
    await inventory.periodAction(actor, '202603', 'close');
    await inventory.periodAction(actor, '202604', 'close');
    await inventory.periodAction(actor, '202603', 'unlock');
    await post('GENERAL_IN', '10', '30', { postingDate: '20260310' });
    expect(
      (await inventory.monthly(actor, '202604')).period?.summaryDirty,
    ).toBe(true);
    await expect(
      inventory.periodAction(actor, '202604', 'close'),
    ).rejects.toThrow('전월');
    await inventory.periodAction(actor, '202603', 'close');
    const april = await inventory.periodAction(actor, '202604', 'close');
    expect(april.sites[0]).toMatchObject({
      openingQuantity: '20.000000',
      openingAmount: '400',
      issueAmount: '100',
      closingAmount: '300',
    });
    expect(april.period?.summaryDirty).toBe(false);
  });
});

it('connects server-numbered requests, merged order, full receipt and renamed monthly stock entities', async () => {
  const numbering = new NumberingService(db);
  const requests = new PurchaseRequestController(
    numbering,
    new PurchaseRequestService(purchases),
  );
  const orders = new PurchaseOrderController(
    numbering,
    new PurchaseOrderService(purchases),
    purchases,
  );
  const transactions = new InventoryController(numbering, inventory);
  const attachment = await db
    .getRepository(Attachment)
    .save({
      companyId: actor.companyId,
      attachmentId: randomUUID(),
      refModule: 'purchase_request',
      refId: null,
      createdBy: actor.userId,
    });
  const key = randomUUID();
  const requestDto = {
    requestId: randomUUID(),
    title: '첫 요청',
    attachmentId: attachment.attachmentId,
    items: [{ itemId: randomUUID(), materialId: 'M1', quantity: '3' }],
  };
  const first = await requests.create(actor, requestDto, key);
  expect(first.requestId).toMatch(/^PURREQ-\d{6}-00001$/);
  expect(first.requestId).not.toBe(requestDto.requestId);
  expect((await requests.create(actor, requestDto, key)).requestId).toBe(
    first.requestId,
  );
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ attachmentId: attachment.attachmentId })
    ).refId,
  ).toBe(first.requestId);
  const second = await requests.create(
    actor,
    {
      requestId: randomUUID(),
      title: '둘째 요청',
      items: [{ itemId: randomUUID(), materialId: 'M1', quantity: '2' }],
    },
    randomUUID(),
  );
  for (const row of [first, second]) {
    await purchases.sync(
      'request',
      actor.companyId,
      row.requestId!,
      'P',
      actor.userId,
    );
    await purchases.sync(
      'request',
      actor.companyId,
      row.requestId!,
      'C',
      actor.userId,
    );
  }
  const requestIds = [first.requestId!, second.requestId!];
  const preview = await purchases.preview(actor, requestIds);
  expect(preview.items).toHaveLength(1);
  const order = await orders.create(
    actor,
    {
      orderId: randomUUID(),
      documentNo: '',
      title: '병합 발주',
      requestIds,
      items: preview.items.map((i) => ({
        itemId: i.itemId,
        materialId: i.materialId,
        quantity: i.quantity,
        unitPrice: '12',
      })),
    },
    randomUUID(),
  );
  expect(order.orderId).toMatch(/^PURORD-\d{6}-00001$/);
  expect(order.allocations).toHaveLength(2);
  expect(new Set(order.allocations.map((a) => a.requestId))).toEqual(
    new Set(requestIds),
  );
  await purchases.sync(
    'order',
    actor.companyId,
    order.orderId!,
    'P',
    actor.userId,
  );
  await purchases.sync(
    'order',
    actor.companyId,
    order.orderId!,
    'C',
    actor.userId,
  );
  await inventory.periodAction(actor, '202603', 'open');
  const source = await inventory.reference(
    actor,
    'purchase_order',
    order.orderId!,
  );
  const receiptDto = {
    title: '발주 입고',
    siteId: 'S1',
    warehouseId: 'W1',
    typeCode: 'PURCHASE_IN',
    postingDate: '20260301',
    refModule: 'purchase_order',
    refId: order.orderId,
    items: source.items.map((i) => ({
      itemId: randomUUID(),
      materialId: i.materialId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      refItemId: i.refItemId,
    })),
  };
  const receiptKey = randomUUID();
  const receipt = await transactions.create(actor, receiptDto, receiptKey);
  expect(receipt.inventoryDocumentId).toMatch(/^INVDOC-\d{6}-00001$/);
  expect(receipt.referenceNo).toBe(order.orderId);
  expect(
    (await transactions.create(actor, receiptDto, receiptKey))
      .inventoryDocumentId,
  ).toBe(receipt.inventoryDocumentId);
  await transactions.confirm(actor, receipt.inventoryDocumentId);
  const posted = await inventory.get(actor, receipt.inventoryDocumentId);
  expect(posted.postingSequence).toBe('1');
  await inventory.periodAction(actor, '202603', 'close');
  const balance = await db
    .getRepository(inventoryEntities.MonthlyStockBalance)
    .findOneByOrFail({ companyId: actor.companyId });
  const valuation = await db
    .getRepository(inventoryEntities.MonthlyStockValuation)
    .findOneByOrFail({ companyId: actor.companyId });
  expect(Number(balance.closingQuantity)).toBe(5);
  expect(Number(valuation.closingAmount)).toBe(60);
  expect(db.getMetadata(inventoryEntities.StockInTransit).tableName).toBe(
    'stock_in_transit',
  );
  expect(
    db.getMetadata(inventoryEntities.MonthlyStockInTransit).tableName,
  ).toBe('monthly_stock_in_transit');
});

it('validates HTTP create payloads and accepts numbered purchase references without UUID document IDs', async () => {
  const module = await Test.createTestingModule({
    controllers: [
      PurchaseRequestController,
      PurchaseOrderController,
      InventoryController,
    ],
    providers: [
      { provide: NumberingService, useValue: new NumberingService(db) },
      {
        provide: PurchaseRequestService,
        useValue: new PurchaseRequestService(purchases),
      },
      {
        provide: PurchaseOrderService,
        useValue: new PurchaseOrderService(purchases),
      },
      { provide: PurchaseService, useValue: purchases },
      { provide: InventoryService, useValue: inventory },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest<{ user: UserContext }>().user = actor;
        return true;
      },
    })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  try {
    const client = request(
      app.getHttpServer() as Parameters<typeof request>[0],
    );
    const key = randomUUID(),
      payload = {
        requestId: 'client-value-is-ignored',
        title: 'HTTP 요청',
        items: [{ materialId: 'M1', quantity: '4' }],
      };
    const first = await client
      .post('/purchase-request')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const requestId = (first.body as { requestId: string }).requestId;
    expect(requestId).toMatch(/^PURREQ-\d{6}-00001$/);
    const retry = await client
      .post('/purchase-request')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect((retry.body as { requestId: string }).requestId).toBe(requestId);
    await client.post('/purchase-request').send(payload).expect(400);
    await client
      .post('/purchase-request')
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, companyId: 'OTHER' })
      .expect(400);
    await purchases.sync(
      'request',
      actor.companyId,
      requestId,
      'P',
      actor.userId,
    );
    await purchases.sync(
      'request',
      actor.companyId,
      requestId,
      'C',
      actor.userId,
    );
    const preview = await client
      .post('/purchase-order/request-preview')
      .send({ requestIds: [requestId] })
      .expect(201);
    const previewItems = (
      preview.body as {
        items: { itemId: string; materialId: string; quantity: string }[];
      }
    ).items;
    const orderResponse = await client
      .post('/purchase-order')
      .set('Idempotency-Key', randomUUID())
      .send({
        title: 'HTTP 병합 발주',
        requestIds: [requestId],
        items: previewItems.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          unitPrice: '10',
        })),
      })
      .expect(201);
    const orderId = (orderResponse.body as { orderId: string }).orderId;
    expect(orderId).toMatch(/^PURORD-/);
    await purchases.sync('order', actor.companyId, orderId, 'P', actor.userId);
    await purchases.sync('order', actor.companyId, orderId, 'C', actor.userId);
    const source = await inventory.reference(actor, 'purchase_order', orderId);
    const receiptResponse = await client
      .post('/inventory-document')
      .set('Idempotency-Key', randomUUID())
      .send({
        title: 'HTTP 구매입고',
        typeCode: 'PURCHASE_IN',
        postingDate: '20260301',
        siteId: 'S1',
        warehouseId: 'W1',
        refModule: 'purchase_order',
        refId: orderId,
        items: source.items.map((i) => ({
          materialId: i.materialId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          refItemId: i.refItemId,
        })),
      })
      .expect(201);
    expect(
      (receiptResponse.body as { inventoryDocumentId: string })
        .inventoryDocumentId,
    ).toMatch(/^INVDOC-/);
    expect((receiptResponse.body as { referenceNo: string }).referenceNo).toBe(
      orderId,
    );
  } finally {
    await app.close();
  }
});
