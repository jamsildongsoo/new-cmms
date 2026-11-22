import {
  actor,
  db,
  inventory,
  stockQueries,
  closing,
  post,
} from '../../../test/support/purchase-inventory.fixture';
import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NumberingService } from '../../numbering/numbering.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryDocument } from './entities/inventory-document.entity';
import { PurchaseOrder } from '../../purchase/purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../purchase/purchase-order/entities/purchase-order-item.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { randomUUID } from 'node:crypto';
import { StockBalance } from '../stock/entities/stock-balance.entity';
it('scopes stock reports to company or own site and maps department scope to site without changing stock calculation', async () => {
  await closing.periodAction(actor, '202603', 'open');
  await post('GENERAL_IN', '1', '100', { deptId: 'D1' });
  await post('GENERAL_IN', '2', '100', { deptId: 'D2' });
  await post('GENERAL_IN', '3', '100', {
    siteId: 'S2',
    warehouseId: 'W1',
    deptId: 'D2',
  });
  // 다른 회사에 같은 사업장 ID가 있어도 조회 결과에 포함하지 않는다.
  await db.getRepository(StockBalance).save({
    companyId: 'OTHER',
    siteId: 'S1',
    warehouseId: 'W1',
    materialId: 'M1',
    quantity: '99',
  });
  const whole = await stockQueries.balances(actor);
  expect(whole.sites).toHaveLength(2);
  expect(await stockQueries.ledger(actor)).toHaveLength(3);
  for (const accessScope of ['OWN_SITE', 'OWN_DEPARTMENT'] as const) {
    const user = { ...actor, accessScope };
    const report = await stockQueries.balances(user);
    expect(report.warehouses).toHaveLength(1);
    expect(report.sites).toHaveLength(1);
    expect(report.sites[0]).toMatchObject({
      companyId: actor.companyId,
      siteId: 'S1',
      quantity: '3',
      amount: '300',
    });
    // 부서가 다른 입고도 같은 사업장 재고에는 모두 반영되어야 한다.
    const ledger = await stockQueries.ledger(user);
    expect(ledger).toHaveLength(2);
    expect(ledger.every((row) => row.siteId === 'S1')).toBe(true);
    expect(await stockQueries.balances(user, { siteId: 'S2' })).toEqual({
      warehouses: [],
      sites: [],
    });
    expect(await stockQueries.ledger(user, { siteId: 'S2' })).toEqual([]);
    expect(
      await stockQueries.ledger(user, {
        warehouseId: 'W1',
        materialId: 'M1',
        from: '20260301',
        to: '20260301',
      }),
    ).toHaveLength(2);
    await expect(
      stockQueries.balances({ ...user, siteId: null }),
    ).rejects.toThrow('소속 사업장');
    await expect(
      stockQueries.ledger({ ...user, siteId: null }),
    ).rejects.toThrow('소속 사업장');
  }
  expect(
    (
      await stockQueries.balances({
        ...actor,
        accessScope: 'OWN_DEPARTMENT',
        siteId: 'S2',
      })
    ).sites[0].quantity,
  ).toBe('3');
  expect(
    (await stockQueries.balances(actor, { siteId: 'S2' })).warehouses,
  ).toHaveLength(1);
  expect(
    (await stockQueries.balances(actor)).sites.map((row) => row.quantity),
  ).toEqual(['3', '3']);
});
async function balance(siteId = 'S1', warehouseId = 'W1') {
  return db.getRepository(StockBalance).findOneBy({
    companyId: actor.companyId,
    siteId,
    warehouseId,
    materialId: 'M1',
  });
}
async function pending(out: Awaited<ReturnType<typeof post>>, user = actor) {
  const rows = (await inventory.list(user, { type: 'IN', status: 'W' })).items;
  const documents = await Promise.all(
    rows.map((row) => inventory.get(user, row.inventoryDocumentId)),
  );
  return documents.find((row) => row.refId === out.inventoryDocumentId)!;
}
const receiver = {
  ...actor,
  userId: 'receiver',
  siteId: 'S2',
  deptId: 'D2',
  accessScope: 'OWN_DEPARTMENT' as const,
};

it('changes only the affected warehouse and never reprices existing issues after backdated receipts', async () => {
  await post('GENERAL_IN', '3', '1');
  await post('GENERAL_IN', '3', '2');
  await post('GENERAL_IN', '10', '100', { warehouseId: 'W2' });
  const unrelated = await balance('S1', 'W2');
  const issue = await post('GENERAL_OUT', '2');
  expect(issue.items[0]).toMatchObject({ amount: '2', unitPrice: '1' });
  await post('GENERAL_IN', '1', '10', { postingDate: '20260301' });
  expect(
    (await inventory.get(actor, issue.inventoryDocumentId)).items[0].amount,
  ).toBe('2');
  expect(await balance()).toMatchObject({ quantity: '5.000000', amount: '17' });
  expect(await balance('S1', 'W2')).toEqual(unrelated);
  const all = await post('GENERAL_OUT', '5');
  expect(all.items[0].amount).toBe('15');
  expect(await balance()).toMatchObject({ quantity: '0.000000', amount: '2' });
  await inventory.cancel(actor, all.inventoryDocumentId, '원금액 복원');
  expect(await balance()).toMatchObject({ quantity: '5.000000', amount: '17' });
});
it.each([
  ['S1', 'W2'],
  ['S2', 'W1'],
])(
  'creates two linked documents and applies exact stored transfer cost on confirmation and cancellation at %s/%s',
  async (toSiteId, toWarehouseId) => {
    await post('GENERAL_IN', '6', '10');
    const out = await post('TRANSFER_OUT', '2', '0', {
      toSiteId,
      toWarehouseId,
    });
    const inbound = await pending(out);
    expect(inbound).toMatchObject({
      type: 'IN',
      status: 'W',
      siteId: toSiteId,
      warehouseId: toWarehouseId,
      postingSequence: null,
      confirmedAt: null,
    });
    expect(await db.getRepository(InventoryDocument).count()).toBe(3);
    expect(await balance(toSiteId, toWarehouseId)).toBeNull();
    await post('GENERAL_IN', '1', '100', {
      siteId: toSiteId,
      warehouseId: toWarehouseId,
    });
    const confirmed = await inventory.confirm(
      actor,
      inbound.inventoryDocumentId,
      '20260302',
    );
    expect(confirmed).toMatchObject({
      status: 'C',
      confirmedBy: actor.userId,
      postingDate: '20260302',
    });
    expect(confirmed.items[0].amount).toBe('20');
    expect(confirmed.postingSequence).not.toBeNull();
    expect(await balance(toSiteId, toWarehouseId)).toMatchObject({
      quantity: '3.000000',
      amount: '120',
    });
    await expect(
      inventory.confirm(actor, inbound.inventoryDocumentId, '20260302'),
    ).rejects.toThrow('수령 대기');
    await expect(
      inventory.cancel(actor, out.inventoryDocumentId, '잘못된 순서'),
    ).rejects.toThrow('마지막 확정');
    await inventory.cancel(actor, inbound.inventoryDocumentId, '수령 취소');
    expect(await balance(toSiteId, toWarehouseId)).toMatchObject({
      quantity: '1.000000',
      amount: '100',
    });
    await expect(
      inventory.confirm(actor, inbound.inventoryDocumentId, '20260302'),
    ).rejects.toThrow('수령 대기');
    expect((await inventory.list(actor, { status: 'W' })).items).toEqual([]);
  },
);
it('cancels a dispatch and waiting receipt together without touching destination stock', async () => {
  await post('GENERAL_IN', '2', '5');
  const out = await post('TRANSFER_OUT', '2', '0', {
    toSiteId: 'S2',
    toWarehouseId: 'W1',
  });
  const inbound = await pending(out);
  await inventory.cancel(actor, out.inventoryDocumentId, '배송 취소');
  expect(
    (await inventory.get(receiver, inbound.inventoryDocumentId)).status,
  ).toBe('X');
  expect(await balance()).toMatchObject({ quantity: '2.000000', amount: '10' });
  expect(await balance('S2', 'W1')).toBeNull();
});
it('cancels a confirmed receipt then dispatch in latest sequence order with original amounts', async () => {
  await post('GENERAL_IN', '2', '7');
  const out = await post('TRANSFER_OUT', '2', '0', {
    toSiteId: 'S2',
    toWarehouseId: 'W1',
  });
  const inbound = await pending(out, receiver);
  await inventory.confirm(receiver, inbound.inventoryDocumentId, '20260301');
  await inventory.cancel(receiver, inbound.inventoryDocumentId, '입고 취소');
  await inventory.cancel(actor, out.inventoryDocumentId, '출고 취소');
  expect(await balance()).toMatchObject({ quantity: '2.000000', amount: '14' });
  expect(await balance('S2', 'W1')).toMatchObject({
    quantity: '0.000000',
    amount: '0',
  });
});
it('uses site scope for department users and requires receiving-site access to confirm', async () => {
  await post('GENERAL_IN', '3', '10');
  const sender = { ...actor, accessScope: 'OWN_DEPARTMENT' as const };
  const out = await post(
    'TRANSFER_OUT',
    '1',
    '0',
    { toSiteId: 'S2', toWarehouseId: 'W1' },
    sender,
  );
  const inbound = await pending(out, receiver);
  expect(inbound).toBeDefined();
  await expect(
    inventory.get(receiver, out.inventoryDocumentId),
  ).rejects.toThrow('범위');
  await expect(
    inventory.confirm(sender, inbound.inventoryDocumentId, '20260301'),
  ).rejects.toThrow('범위');
  await expect(
    inventory.get(
      { ...actor, companyId: 'OTHER' },
      inbound.inventoryDocumentId,
    ),
  ).rejects.toThrow();
  await expect(
    post('GENERAL_IN', '1', '1', { siteId: 'S2' }, sender),
  ).rejects.toThrow('사업장 범위');
  expect(
    (await inventory.confirm(receiver, inbound.inventoryDocumentId, '20260301'))
      .confirmedBy,
  ).toBe('receiver');
});
it('permits cross-month receiving even for same-site transfers and excludes waiting documents from reports', async () => {
  await post('GENERAL_IN', '10', '10');
  const out = await post('TRANSFER_OUT', '2', '0', {
    toSiteId: 'S1',
    toWarehouseId: 'W2',
  });
  const inbound = await pending(out);
  const march = await closing.periodAction(actor, '202603', 'close');
  expect(march.warehouses).toHaveLength(1);
  expect(march.warehouses[0]).toMatchObject({
    closingQuantity: '8',
    closingAmount: '80',
    issueAmount: '-20',
  });
  await closing.periodAction(actor, '202604', 'open');
  await expect(
    inventory.confirm(actor, inbound.inventoryDocumentId, '20260302'),
  ).rejects.toThrow('마감');
  await inventory.confirm(actor, inbound.inventoryDocumentId, '20260401');
  const april = await closing.monthly(actor, '202604');
  expect(april.warehouses.find((w) => w.warehouseId === 'W2')).toMatchObject({
    openingQuantity: '0',
    receiptQuantity: '2',
    receiptAmount: '20',
    closingAmount: '20',
  });
  expect((await closing.monthly(actor, '202603')).warehouses).toEqual(
    march.warehouses,
  );
});
it('allows independent quantity and amount adjustments including zero-quantity value balances', async () => {
  const adjustment = (quantity: string, amount: string) =>
    post('ADJUST', quantity, '0', {
      items: [{ materialId: 'M1', quantity, amount }],
    });
  await adjustment('0', '15');
  expect((await stockQueries.balances(actor)).warehouses[0]).toMatchObject({
    quantity: '0.000000',
    amount: '15',
    averagePrice: null,
  });
  await adjustment('2', '0');
  await adjustment('-1', '-3');
  expect(await balance()).toMatchObject({ quantity: '1.000000', amount: '12' });
  await expect(adjustment('-2', '0')).rejects.toThrow('음수');
  await expect(adjustment('0', '-13')).rejects.toThrow('음수');
  await expect(adjustment('0', '0')).rejects.toThrow('모두 0');
  expect(await db.getRepository(InventoryDocument).count()).toBe(3);
});
it('rolls back all lines and both transfer documents on failure and preserves repeated-material line costs', async () => {
  await post('GENERAL_IN', '2', '10');
  const items = [
    { materialId: 'M1', quantity: '1' },
    { materialId: 'M1', quantity: '2' },
  ];
  await expect(
    post('TRANSFER_OUT', '3', '0', {
      toSiteId: 'S2',
      toWarehouseId: 'W1',
      items,
    }),
  ).rejects.toThrow('부족');
  expect(await db.getRepository(InventoryDocument).count()).toBe(1);
  expect((await inventory.list(actor, { status: 'W' })).items).toEqual([]);
  expect(await balance()).toMatchObject({ quantity: '2.000000', amount: '20' });
  const issue = await post('GENERAL_OUT', '2', '0', {
    items: [
      { materialId: 'M1', quantity: '1' },
      { materialId: 'M1', quantity: '1' },
    ],
  });
  expect(issue.items.map((i) => i.amount)).toEqual(['10', '10']);
  await inventory.cancel(actor, issue.inventoryDocumentId, '반복 자재 복원');
  expect(await balance()).toMatchObject({ quantity: '2.000000', amount: '20' });
});
it('rejects partial and duplicate purchase receipts and keeps company-wide source options', async () => {
  const orderId = randomUUID();
  await db.getRepository(PurchaseOrder).save({
    companyId: actor.companyId,
    orderId,
    documentNo: '',
    title: '본사발주',
    requesterId: 'owner',
    siteId: 'S1',
    deptId: 'D1',
    toSiteId: 'S2',
    status: 'C',
    createdBy: 'owner',
    deleteYn: 'N',
  });
  const itemId = randomUUID();
  await db.getRepository(PurchaseOrderItem).save({
    companyId: actor.companyId,
    orderId,
    itemId,
    sortOrder: 0,
    materialId: 'M1',
    materialName: '베어링',
    baseUnit: 'EA',
    quantity: '2',
    unitPrice: '7',
    amount: '14',
  });
  expect(
    (await inventory.options(actor)).orders.map((o) => o.orderId),
  ).toContain(orderId);
  expect(
    (await inventory.options({ ...actor, accessScope: 'OWN_DEPARTMENT' }))
      .orders,
  ).toEqual([]);
  const payload = {
    siteId: 'S2',
    refModule: 'PURORD',
    refId: orderId,
    items: [{ materialId: 'M1', quantity: '2', refItemId: itemId }],
  };
  await expect(
    post(
      'PURCHASE_IN',
      '1',
      '0',
      { ...payload, items: [{ ...payload.items[0], quantity: '1' }] },
      receiver,
    ),
  ).rejects.toThrow('전체 품목');
  const results = await Promise.allSettled([
    post('PURCHASE_IN', '2', '0', payload, receiver),
    post('PURCHASE_IN', '2', '0', payload, receiver),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await balance('S2', 'W1')).toMatchObject({
    quantity: '2.000000',
    amount: '14',
  });
  expect((await inventory.options(actor)).orders).toEqual([]);
});
it('rejects new quantity precision and decimal unit prices before stock changes', async () => {
  await expect(post('GENERAL_IN', '1.234', '10')).rejects.toThrow(
    '소수점 2자리',
  );
  await expect(post('GENERAL_IN', '1', '10.5')).rejects.toThrow('소수점 0자리');
  expect(await db.getRepository(InventoryDocument).count()).toBe(0);
  await post('GENERAL_IN', '1.23', '10');
  expect(await balance()).toMatchObject({ quantity: '1.230000', amount: '12' });
});
it('exposes API permission prerequisites and confirms the existing waiting receipt without a new document', async () => {
  await post('GENERAL_IN', '1', '10');
  const out = await post('TRANSFER_OUT', '1', '0', {
    toSiteId: 'S2',
    toWarehouseId: 'W1',
  });
  const inbound = await pending(out, receiver);
  let user: UserContext = { ...receiver, permissions: ['INVDOC:update'] };
  const module = await Test.createTestingModule({
    controllers: [InventoryController],
    providers: [
      { provide: InventoryService, useValue: inventory },
      { provide: NumberingService, useValue: new NumberingService(db) },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        context.switchToHttp().getRequest().user = user;
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  try {
    const url = `/inventory-document/${inbound.inventoryDocumentId}/confirm`;
    await request(app.getHttpServer())
      .post(url)
      .send({ postingDate: '20260301' })
      .expect(403);
    user = { ...user, permissions: ['INVDOC:read', 'INVDOC:update'] };
    const response = await request(app.getHttpServer())
      .post(url)
      .send({ postingDate: '20260301' })
      .expect(201);
    expect(response.body.status).toBe('C');
    expect(await db.getRepository(InventoryDocument).count()).toBe(3);
  } finally {
    await app.close();
  }
});

it('filters each inventory menu and waiting state without widening site scope', async () => {
  await post('GENERAL_IN', '3', '10');
  await post('GENERAL_OUT', '1');
  await post('TRANSFER_OUT', '1', '0', { toSiteId: 'S2', toWarehouseId: 'W1' });
  expect((await inventory.list(actor, { type: 'IN' })).total).toBe(2);
  expect(
    (await inventory.list(actor, { type: 'OUT', kind: 'GENERAL' })).total,
  ).toBe(1);
  expect(
    (await inventory.list(actor, { type: 'OUT', kind: 'TRANSFER' })).total,
  ).toBe(1);
  expect(
    (await inventory.list(receiver, { status: 'W', type: 'IN' })).total,
  ).toBe(1);
  expect((await inventory.list(receiver, { siteId: 'S1' })).total).toBe(0);
  expect((await inventory.list(actor, { materialId: 'OTHER' })).total).toBe(0);
});

it('floors the warehouse unit price before multiplying and keeps user text with the calculation in the item note', async () => {
  await post('ADJUST', '30', '0', {
    items: [{ materialId: 'M1', quantity: '30', amount: '10000' }],
  });
  const issue = await post('GENERAL_OUT', '7', '0', {
    items: [{ materialId: 'M1', quantity: '7', note: '보수 작업 사용' }],
  });
  expect(issue.items[0]).toMatchObject({ unitPrice: '333', amount: '2331' });
  expect(issue.items[0].note).toContain('보수 작업 사용\n출고 계산:');
  expect(issue.items[0].note).toContain('단가 333원(원 미만 버림)');
  expect(issue.items[0].note).toContain('출고금액 2331원');
  expect(await balance()).toMatchObject({
    quantity: '23.000000',
    amount: '7669',
  });
  await inventory.cancel(actor, issue.inventoryDocumentId, '반납');
  expect(await balance()).toMatchObject({
    quantity: '30.000000',
    amount: '10000',
  });
  expect(
    (await inventory.get(actor, issue.inventoryDocumentId)).items[0].note,
  ).toBe(issue.items[0].note);
});
it.each([
  ['6', '10000', '6', '1666', '9996', '0.000000', '4'],
  ['3', '2', '3', '0', '0', '0.000000', '2'],
  ['1.25', '4', '0.5', '3', '2', '0.750000', '2'],
])(
  'uses the same floor-then-multiply rule for quantity %s and balance amount %s',
  async (
    quantity,
    amount,
    issueQuantity,
    unitPrice,
    issueAmount,
    remainingQuantity,
    remainingAmount,
  ) => {
    await post('ADJUST', quantity, '0', {
      items: [{ materialId: 'M1', quantity, amount }],
    });
    const issue = await post('GENERAL_OUT', issueQuantity);
    expect(issue.items[0]).toMatchObject({ unitPrice, amount: issueAmount });
    expect(await balance()).toMatchObject({
      quantity: remainingQuantity,
      amount: remainingAmount,
    });
    const report = (await stockQueries.balances(actor)).warehouses[0];
    if (remainingQuantity === '0.000000')
      expect(report.averagePrice).toBeNull();
  },
);
it('copies the floored dispatch price, exact amount and calculation note into the waiting receipt', async () => {
  await post('ADJUST', '6', '0', {
    items: [{ materialId: 'M1', quantity: '6', amount: '10000' }],
  });
  const out = await post('TRANSFER_OUT', '2', '0', {
    toSiteId: 'S2',
    toWarehouseId: 'W1',
  });
  const inbound = await pending(out, receiver);
  expect(inbound.items[0]).toMatchObject({
    unitPrice: '1666',
    amount: '3332',
    note: out.items[0].note,
  });
  const confirmed = await inventory.confirm(
    receiver,
    inbound.inventoryDocumentId,
    '20260301',
  );
  expect(confirmed.items[0].amount).toBe('3332');
  await inventory.cancel(receiver, inbound.inventoryDocumentId, '수령 취소');
  await inventory.cancel(actor, out.inventoryDocumentId, '출고 취소');
  expect(await balance()).toMatchObject({
    quantity: '6.000000',
    amount: '10000',
  });
});
