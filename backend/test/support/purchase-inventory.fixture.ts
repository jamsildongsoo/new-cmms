import { StockProcessingService } from '../../src/inventory/stock/stock-processing.service';
import { StockQueryService } from '../../src/inventory/stock/stock-query.service';
import { MonthlyClosingService } from '../../src/inventory/monthly-closing/monthly-closing.service';

import { NumberingService } from '../../src/numbering/numbering.service';
import { NumberSequence } from '../../src/numbering/entities/number-sequence.entity';
import { Attachment } from '../../src/attachments/entities/attachment.entity';

import { PurchaseRequestService } from '../../src/purchase/purchase-request/purchase-request.service';

import { PurchaseOrderService } from '../../src/purchase/purchase-order/purchase-order.service';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from './pglite';
import { UserContext } from '../../src/auth/types/user-context.type';
import { CodeItem } from '../../src/codes/code-items/entities/code-item.entity';
import { Site } from '../../src/organization/sites/entities/site.entity';
import { Department } from '../../src/organization/departments/entities/department.entity';
import { Warehouse } from '../../src/organization/warehouses/entities/warehouse.entity';
import { User } from '../../src/identity/users/entities/user.entity';
import { Material } from '../../src/inventory/material/entities/material.entity';
import { PurchaseRequest } from '../../src/purchase/purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../../src/purchase/purchase-order/entities/purchase-order.entity';
import { PurchaseRequestItem } from '../../src/purchase/purchase-request/entities/purchase-request-item.entity';
import { PurchaseOrderItem } from '../../src/purchase/purchase-order/entities/purchase-order-item.entity';
import { Vendor } from '../../src/purchase/vendor/entities/vendor.entity';
import { InventoryService } from '../../src/inventory/transactions/inventory.service';
import { CreateInventoryDto } from '../../src/inventory/transactions/dto/inventory.dto';
import { InventoryDocument } from '../../src/inventory/transactions/entities/inventory-document.entity';
import { InventoryItem } from '../../src/inventory/transactions/entities/inventory-item.entity';
import { InventoryControl } from '../../src/inventory/transactions/entities/inventory-control.entity';
import { StockBalance } from '../../src/inventory/stock/entities/stock-balance.entity';
import { InventoryPeriodLock } from '../../src/inventory/monthly-closing/entities/inventory-period-lock.entity';

jest.setTimeout(90000);
export const actor = {
  companyId: 'TEST',
  userId: 'owner',
  siteId: 'S1',
  deptId: 'D1',
  roleId: 'ADMIN',
  accessScope: 'COMPANY_ALL',
  permissions: [],
} as UserContext;
export let db: DataSource,
  requestService: PurchaseRequestService,
  orderService: PurchaseOrderService,
  inventory: InventoryService,
  stockQueries: StockQueryService,
  closing: MonthlyClosingService,
  dispose: () => Promise<void>;
const entities = [
  NumberSequence,
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
  Vendor,
  InventoryDocument,
  InventoryItem,
  InventoryControl,
  StockBalance,
  InventoryPeriodLock,
];
beforeAll(async () => {
  const fixture = await postgresTestDatabase(entities);
  db = fixture.dataSource;
  dispose = fixture.close;
  requestService = new PurchaseRequestService(db);
  orderService = new PurchaseOrderService(db, requestService);
  const processing = new StockProcessingService();
  stockQueries = new StockQueryService(db);
  closing = new MonthlyClosingService(db, processing, stockQueries);
  inventory = new InventoryService(db, processing, new NumberingService(db));
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
  await closing.periodAction(actor, '202603', 'open');
});
export const kindMap = {
  GENERAL_IN: { type: 'IN', kind: 'GENERAL' },
  GENERAL_OUT: { type: 'OUT', kind: 'GENERAL' },
  PURCHASE_IN: { type: 'IN', kind: 'PURCHASE' },
  TRANSFER_OUT: { type: 'OUT', kind: 'TRANSFER' },
  ADJUST: { type: 'ADJUST', kind: null },
} as const;
export async function post(
  kind: keyof typeof kindMap,
  quantity: string,
  unitPrice = '10',
  overrides: Partial<CreateInventoryDto> = {},
  user = actor,
) {
  return inventory.create(user, {
    inventoryDocumentId: await new NumberingService(db).generateDocumentId(
      user.companyId,
      'INVDOC',
    ),
    title: kind,
    documentNo: '',
    ...kindMap[kind],
    postingDate: '20260301',
    siteId: 'S1',
    warehouseId: 'W1',
    deptId: user.deptId,
    reason: '실사',
    items: [{ itemId: randomUUID(), materialId: 'M1', quantity, unitPrice }],
    ...overrides,
  });
}
export async function approvedRequest(quantity: string) {
  const id = randomUUID();
  await requestService.save(
    actor,
    id,
    {
      title: '구매요청',
      requestDate: '20260301',
      items: [{ itemId: randomUUID(), materialId: 'M1', quantity }],
    },
    true,
  );
  await requestService.assertCanSubmit(actor, id);
  await requestService.syncApprovalStatus(actor.companyId, id, 'P', 'owner');
  await requestService.syncApprovalStatus(actor.companyId, id, 'C', 'manager');
  return requestService.findOne(actor, id);
}
