import {
  actor,
  db,
  requestService,
  orderService,
  inventory,
  closing,
  post,
  approvedRequest,
} from '../../../test/support/purchase-inventory.fixture';
import { randomUUID } from 'node:crypto';
import { DocumentStatus } from '../../common/constants/document-status';
import { PurchaseRequest } from './entities/purchase-request.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { Vendor } from '../vendor/entities/vendor.entity';
import { VendorService } from '../vendor/vendor.service';
import { Material } from '../../inventory/material/entities/material.entity';
import { MaterialService } from '../../inventory/material/material.service';
import { CodeValidationService } from '../../codes/code-validation.service';
it('rejects repeated document UUID creation without changing the saved document', async () => {
  const id = randomUUID();
  await requestService.save(actor, id, { title: '원본', items: [] }, true);
  await expect(
    requestService.save(actor, id, { title: '덮어쓰기 시도', items: [] }, true),
  ).rejects.toThrow('이미 존재');
  expect((await requestService.findOne(actor, id)).title).toBe('원본');
});
it('manages company-wide vendors with audit fields, pagination and soft deletion', async () => {
  const vendors = new VendorService(db.getRepository(Vendor));
  const other = { ...actor, companyId: 'OTHER' };
  const created = await vendors.create(actor, {
    vendorId: 'V1',
    name: '공급업체',
    registrationNumber: '123-45-67890',
  });
  expect(created).toMatchObject({
    companyId: actor.companyId,
    createdBy: 'owner',
    deleteYn: 'N',
  });
  await vendors.create(other, { vendorId: 'V1', name: '다른 회사 거래처' });
  expect(
    (await vendors.list(actor, { search: '67890', page: 1, limit: 1 })).total,
  ).toBe(1);
  await expect(vendors.get(other, 'MISSING')).rejects.toThrow();
  const manager = { ...actor, userId: 'manager' };
  const updated = await vendors.update(manager, 'V1', {
    name: '새 거래처명',
    phoneNumber: '02-1234-5678',
  });
  expect(updated.updatedBy).toBe('manager');
  expect(updated.registrationNumber).toBe('123-45-67890');
  expect(
    (await vendors.update(manager, 'V1', { phoneNumber: '02-9999-9999' })).name,
  ).toBe('새 거래처명');
  await expect(vendors.update(manager, 'V1', { name: '  ' })).rejects.toThrow();
  await vendors.remove(manager, 'V1');
  expect((await vendors.list(actor)).total).toBe(0);
  expect((await vendors.get(other, 'V1')).name).toBe('다른 회사 거래처');
  await expect(
    vendors.create(actor, { vendorId: 'V1', name: '번호 재사용' }),
  ).rejects.toThrow();
  await expect(vendors.get(actor, 'V1')).rejects.toThrow();
});
it('reads active vendor details and preserves the stored ID without resolving a deleted vendor', async () => {
  const vendors = new VendorService(db.getRepository(Vendor));
  await vendors.create(actor, {
    vendorId: 'V1',
    name: '최초 공급처',
    contactName: '원 담당자',
    phoneNumber: '111',
  });
  const id = randomUUID();
  const dto = {
    toSiteId: 'S1',
    title: '거래처 발주',
    vendorId: 'V1',
    orderDate: '20260301',
    items: [{ materialId: 'M1', quantity: '2', unitPrice: '10' }],
  };
  const order = await orderService.save(actor, id, dto, true);
  expect(order).toMatchObject({
    vendorId: 'V1',
    vendor: {
      name: '최초 공급처',
      contactName: '원 담당자',
      phoneNumber: '111',
    },
  });
  await vendors.update(actor, 'V1', {
    name: '변경 공급처',
    phoneNumber: '222',
  });
  expect(await vendors.deletionInfo(actor, 'V1')).toEqual({
    purchaseOrderCount: 1,
  });
  await expect(
    vendors.deletionInfo({ ...actor, companyId: 'OTHER' }, 'V1'),
  ).rejects.toThrow();
  expect((await vendors.remove(actor, 'V1')).purchaseOrderCount).toBe(1);
  const saved = await orderService.save(actor, id, dto, false);
  expect(saved).toMatchObject({
    vendorId: 'V1',
    vendor: null,
  });
  expect((await orderService.findAll(actor)).items).toEqual([
    expect.objectContaining({ orderId: id, title: dto.title }),
  ]);
  const persisted = await db
    .getRepository(PurchaseOrder)
    .findOneByOrFail({ companyId: actor.companyId, orderId: id });
  expect(Object.keys(persisted).some((key) => key.startsWith('supplier'))).toBe(
    false,
  );
  await orderService.assertCanSubmit(actor, id);
  expect((await orderService.options(actor)).vendors).toHaveLength(0);
  await expect(
    orderService.save(actor, randomUUID(), dto, true),
  ).rejects.toThrow('거래처');
  await vendors.create(actor, {
    vendorId: 'V3',
    name: '새 업체',
    phoneNumber: '333',
  });
  const changed = await orderService.save(
    actor,
    id,
    { ...dto, vendorId: 'V3' },
    false,
  );
  expect(changed).toMatchObject({
    vendorId: 'V3',
    vendor: { name: '새 업체', phoneNumber: '333' },
  });
  await vendors.create(
    { ...actor, companyId: 'OTHER' },
    { vendorId: 'V2', name: '다른 회사' },
  );
  await expect(
    orderService.save(actor, randomUUID(), { ...dto, vendorId: 'V2' }, true),
  ).rejects.toThrow('거래처');
});
it('rejects unregistered suppliers on save and legacy orders on submission', async () => {
  const dto = {
    title: '미등록 업체',
    toSiteId: 'S1',
    orderDate: '20260301',
    items: [{ materialId: 'M1', quantity: '1', unitPrice: '10' }],
  };
  for (const vendorId of [undefined, null, '', 'MISSING'])
    await expect(
      orderService.save(actor, randomUUID(), { ...dto, vendorId }, true),
    ).rejects.toThrow('거래처');
  await new VendorService(db.getRepository(Vendor)).create(actor, {
    vendorId: 'V1',
    name: '등록 업체',
  });
  const id = randomUUID();
  await orderService.save(actor, id, { ...dto, vendorId: 'V1' }, true);
  await expect(
    orderService.save(actor, id, { ...dto, vendorId: null }, false),
  ).rejects.toThrow('거래처');
  await db
    .getRepository(PurchaseOrder)
    .update({ companyId: actor.companyId, orderId: id }, { vendorId: null });
  await expect(orderService.assertCanSubmit(actor, id)).rejects.toThrow(
    '거래처',
  );
});
it('stores requests without monetary fields and starts order pricing independently', async () => {
  const request = await approvedRequest('2');
  expect(request).not.toHaveProperty('totalAmount');
  expect(request.items[0]).not.toHaveProperty('unitPrice');
  expect(request.items[0]).not.toHaveProperty('amount');
  const preview = await orderService.preview(actor, request.requestId);
  expect(preview.items[0]).toMatchObject({
    quantity: '2.000000',
    unitPrice: null,
    amount: null,
  });
});
it('blocks base-unit changes after stock history while allowing other master edits', async () => {
  const materials = new MaterialService(
    db.getRepository(Material),
    {} as CodeValidationService,
  );
  await materials.update(actor, 'M1', { baseUnit: 'BOX' });
  await materials.update(actor, 'M1', { baseUnit: 'EA' });
  await closing.periodAction(actor, '202603', 'open');
  await post('GENERAL_IN', '2');
  await expect(
    materials.update(actor, 'M1', { baseUnit: 'BOX' }),
  ).rejects.toThrow('기본 단위');
  await materials.update(actor, 'M1', { name: '변경된 명칭' });
  expect((await inventory.list(actor)).items[0].status).toBe('C');
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
it('copies a single request, allows item edits, repeated orders and history after rejection or cancellation', async () => {
  const source = await approvedRequest('10');
  const preview = await orderService.preview(actor, source.requestId);
  expect(Number(preview.items[0].quantity)).toBe(10);
  await new VendorService(db.getRepository(Vendor)).create(actor, {
    vendorId: 'DEFAULT',
    name: '공급처',
  });
  const dto = {
    toSiteId: 'S1',
    title: '수정 발주',
    orderDate: '20260302',
    vendorId: 'DEFAULT',
    refModule: 'PURREQ',
    refId: source.requestId,
    items: [
      { materialId: 'M1', quantity: '4', unitPrice: '12', spec: '수정 규격' },
    ],
  };
  const id = randomUUID(),
    saved = await orderService.save(actor, id, dto, true);
  expect(saved).toMatchObject({
    refModule: 'PURREQ',
    refId: source.requestId,
    totalAmount: '48',
    items: [{ quantity: '4.000000', spec: '수정 규격' }],
  });
  expect(saved).not.toHaveProperty('allocations');
  await orderService.assertCanSubmit(actor, id);
  const duplicate = await orderService.save(
    actor,
    randomUUID(),
    {
      ...dto,
      items: [
        ...dto.items,
        { materialId: 'M1', quantity: '2', unitPrice: '3' },
      ],
    },
    true,
  );
  expect(duplicate.items).toHaveLength(2);
  await orderService.assertCanSubmit(actor, duplicate.orderId);
  for (const status of ['R', 'X'] as const) {
    const o = await orderService.save(actor, randomUUID(), dto, true);
    await orderService.syncApprovalStatus(
      actor.companyId,
      o.orderId,
      'P',
      actor.userId,
    );
    await orderService.syncApprovalStatus(
      actor.companyId,
      o.orderId,
      status,
      actor.userId,
    );
  }
  expect(
    (await orderService.linkedOrders(actor, source.requestId))
      .map((o) => o.status)
      .sort(),
  ).toEqual(['D', 'D', 'R', 'X']);
  const detached = await orderService.save(
    actor,
    id,
    { ...dto, refModule: null, refId: null },
    false,
  );
  expect(detached.refId).toBeNull();
  expect(detached.items[0].quantity).toBe('4.000000');
  await expect(
    orderService.preview({ ...actor, companyId: 'OTHER' }, source.requestId),
  ).rejects.toThrow();
  await expect(
    orderService.linkedOrders(
      { ...actor, companyId: 'OTHER' },
      source.requestId,
    ),
  ).rejects.toThrow();
  await expect(
    orderService.save(actor, randomUUID(), { ...dto, refModule: null }, true),
  ).rejects.toThrow('참조');
  await expect(
    orderService.save({ ...actor, userId: 'other' }, id, dto, false),
  ).rejects.toThrow('작성자');
  const draft = await requestService.create(actor, {
    requestId: randomUUID(),
    title: '미완결 요청',
    items: [],
  });
  await expect(orderService.preview(actor, draft.requestId)).rejects.toThrow(
    '완결',
  );
  await expect(
    orderService.save(
      actor,
      randomUUID(),
      { ...dto, refId: draft.requestId },
      true,
    ),
  ).rejects.toThrow('완결');
  await db
    .getRepository(PurchaseRequest)
    .update(
      { companyId: actor.companyId, requestId: source.requestId },
      { title: '나중에 변경된 요청' },
    );
  expect((await orderService.findOne(actor, duplicate.orderId)).title).toBe(
    '수정 발주',
  );
});
it('paginates purchase lists with literal search and keeps all confirmed reference choices available', async () => {
  const first = await approvedRequest('1');
  const requestRepo = db.getRepository(PurchaseRequest);
  const template = await requestRepo.findOneByOrFail({
    companyId: actor.companyId,
    requestId: first.requestId,
  });
  const time = new Date('2026-03-01T01:00:00Z');
  await requestRepo.save(
    Array.from({ length: 24 }, (_, i) =>
      Object.assign({}, template, {
        requestId: `PURREQ-${String(i).padStart(3, '0')}`,
        createdAt: time,
        title: i === 0 ? '문자%_\\테스트' : '일반 요청',
        documentNo: `관리-${i}`,
      }),
    ),
  );
  const requests = await requestService.findAll(actor);
  expect(requests.total).toBe(25);
  expect(requests.items).toHaveLength(20);
  expect((await requestService.findAll(actor, { page: 2 })).items).toHaveLength(
    5,
  );
  expect(requests.items[0]).not.toHaveProperty('content');
  expect(await requestService.listForReference(actor)).toHaveLength(25);
  for (const search of ['%', '_', '\\', '관리-0'])
    expect((await requestService.findAll(actor, { search })).total).toBe(1);
  await new VendorService(db.getRepository(Vendor)).create(actor, {
    vendorId: 'DEFAULT',
    name: '공급처',
  });
  const base = await orderService.save(
    actor,
    randomUUID(),
    { toSiteId: 'S1', title: '발주', vendorId: 'DEFAULT', items: [] },
    true,
  );
  await db.getRepository(PurchaseOrder).save(
    Array.from({ length: 24 }, (_, i) =>
      Object.assign({}, base, {
        orderId: `PURORD-${String(i).padStart(3, '0')}`,
        createdAt: time,
        status: DocumentStatus.CONFIRMED,
        title: i === 0 ? '발주%_\\문자' : '일반 발주',
        documentNo: `발주관리-${i}`,
      }),
    ),
  );
  const orders = await orderService.findAll(actor);
  expect(orders.total).toBe(25);
  expect(orders.items).toHaveLength(20);
  expect((await orderService.findAll(actor, { page: 2 })).items).toHaveLength(
    5,
  );
  expect(orders.items[0]).not.toHaveProperty('vendor');
  for (const search of ['%', '_', '\\', '발주관리-0'])
    expect((await orderService.findAll(actor, { search })).total).toBe(1);
  expect((await inventory.options(actor)).orders).toHaveLength(24);
  expect((await orderService.options(actor)).requests).toHaveLength(25);
  const vendors = new VendorService(db.getRepository(Vendor));
  await vendors.create(actor, { vendorId: 'SPECIAL', name: '거래처%_\\' });
  for (const search of ['%', '_', '\\'])
    expect((await vendors.list(actor, { search })).total).toBe(1);
});
