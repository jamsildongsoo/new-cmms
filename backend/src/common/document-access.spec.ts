import { NumberingService } from '../numbering/numbering.service';
import { CodeItem } from '../codes/code-items/entities/code-item.entity';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreatePreventiveMaintenanceDto } from '../maintenance/preventive-maintenance/dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from '../maintenance/preventive-maintenance/dto/update-preventive-maintenance.dto';
import type { DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import { postgresTestDatabase } from '../../test/support/pglite';
import type { UserContext } from '../auth/types/user-context.type';
import { Department } from '../organization/departments/entities/department.entity';
import { User } from '../identity/users/entities/user.entity';
import { Equipment } from '../maintenance/equipment/entities/equipment.entity';
import { PreventiveMaintenance } from '../maintenance/preventive-maintenance/entities/preventive-maintenance.entity';
import { PreventiveMaintenanceService } from '../maintenance/preventive-maintenance/preventive-maintenance.service';
import { WorkRequest } from '../maintenance/work-request/entities/work-request.entity';
import { WorkRequestService } from '../maintenance/work-request/work-request.service';
import { WorkOrder } from '../maintenance/work-order/entities/work-order.entity';
import { WorkOrderService } from '../maintenance/work-order/work-order.service';
import { WorkPermitRequest } from '../maintenance/work-permit-request/entities/work-permit-request.entity';
import { WorkPermitRequestService } from '../maintenance/work-permit-request/work-permit-request.service';
import { WorkPermit } from '../maintenance/work-permit/entities/work-permit.entity';
import { WorkPermitService } from '../maintenance/work-permit/work-permit.service';
import { PurchaseRequest } from '../purchase/purchase-request/entities/purchase-request.entity';
import { PurchaseRequestItem } from '../purchase/purchase-request/entities/purchase-request-item.entity';
import { PurchaseRequestService } from '../purchase/purchase-request/purchase-request.service';
import { PurchaseOrder } from '../purchase/purchase-order/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchase/purchase-order/entities/purchase-order-item.entity';
import { PurchaseOrderService } from '../purchase/purchase-order/purchase-order.service';
import { Vendor } from '../purchase/vendor/entities/vendor.entity';
import { InventoryDocument } from '../inventory/transactions/entities/inventory-document.entity';
import { InventoryItem } from '../inventory/transactions/entities/inventory-item.entity';
import { InventoryService } from '../inventory/transactions/inventory.service';
import { StockProcessingService } from '../inventory/stock/stock-processing.service';

jest.setTimeout(90000);
let db: DataSource,
  close: () => Promise<void>,
  pm: PreventiveMaintenanceService;
interface DocumentApi {
  entity: EntityTarget<ObjectLiteral>;
  idField: string;
  list: (user: UserContext) => Promise<ObjectLiteral[]>;
  get: (user: UserContext, id: string) => Promise<ObjectLiteral>;
  remove: (user: UserContext, id: string) => Promise<unknown>;
}
let documents: DocumentApi[];
const actor = (changes: Partial<UserContext> = {}): UserContext => ({
  companyId: 'A',
  userId: 'owner',
  roleId: 'USER',
  siteId: 'S1',
  deptId: 'D1',
  accessScope: 'COMPANY_ALL',
  permissions: ['WRKREQ:read', 'WRKORD:read'],
  ...changes,
});

// Fixture defaults only; the checks below exercise each service's independently implemented SQL.
async function seed(
  entity: EntityTarget<ObjectLiteral>,
  values: ObjectLiteral,
) {
  const defaults: ObjectLiteral = {};
  for (const column of db.getMetadata(entity).columns) {
    if (column.isNullable || column.default !== undefined) continue;
    defaults[column.propertyName] =
      column.type === 'jsonb'
        ? []
        : ['integer', 'numeric', 'bigint'].includes(String(column.type))
          ? 0
          : column.type === 'boolean'
            ? false
            : column.type === 'char' && column.length === '8'
              ? '20261105'
              : 'fixture';
  }
  await db.getRepository(entity).insert({ ...defaults, ...values });
}

beforeAll(async () => {
  const fixture = await postgresTestDatabase([
    CodeItem,
    Department,
    User,
    Equipment,
    PreventiveMaintenance,
    WorkRequest,
    WorkOrder,
    WorkPermitRequest,
    WorkPermit,
    PurchaseRequest,
    PurchaseRequestItem,
    PurchaseOrder,
    PurchaseOrderItem,
    Vendor,
    InventoryDocument,
    InventoryItem,
  ]);
  db = fixture.dataSource;
  close = fixture.close;
  pm = new PreventiveMaintenanceService(
    db.getRepository(PreventiveMaintenance),
    db.getRepository(Equipment),
  );
  const request = new WorkRequestService(
    db.getRepository(WorkRequest),
    db.getRepository(Equipment),
  );
  const order = new WorkOrderService(
    db.getRepository(WorkOrder),
    db.getRepository(Equipment),
    request,
  );
  const permitRequest = new WorkPermitRequestService(
    db.getRepository(WorkPermitRequest),
  );
  const permit = new WorkPermitService(
    db.getRepository(WorkPermit),
    permitRequest,
  );
  const purchaseRequest = new PurchaseRequestService(db);
  const purchaseOrder = new PurchaseOrderService(db, purchaseRequest);
  const inventory = new InventoryService(
    db,
    new StockProcessingService(),
    new NumberingService(db),
  );
  documents = [
    {
      entity: PreventiveMaintenance,
      idField: 'pmId',
      list: async (u) => (await pm.findAll(u)).items,
      get: (u, id) => pm.findOne(u, id),
      remove: (u, id) => pm.remove(u, id),
    },
    {
      entity: WorkRequest,
      idField: 'workRequestId',
      list: async (u) => (await request.findAll(u)).items,
      get: (u, id) => request.findOne(u, id),
      remove: (u, id) => request.remove(u, id),
    },
    {
      entity: WorkOrder,
      idField: 'workOrderId',
      list: async (u) => (await order.findAll(u)).items,
      get: (u, id) => order.findOne(u, id),
      remove: (u, id) => order.remove(u, id),
    },
    {
      entity: WorkPermitRequest,
      idField: 'workPermitRequestId',
      list: async (u) => (await permitRequest.findAll(u)).items,
      get: (u, id) => permitRequest.findOne(u, id),
      remove: (u, id) => permitRequest.remove(u, id),
    },
    {
      entity: WorkPermit,
      idField: 'workPermitId',
      list: async (u) => (await permit.findAll(u)).items,
      get: (u, id) => permit.findOne(u, id),
      remove: (u, id) => permit.remove(u, id),
    },
    {
      entity: PurchaseRequest,
      idField: 'requestId',
      list: async (u) => (await purchaseRequest.findAll(u)).items,
      get: (u, id) => purchaseRequest.findOne(u, id),
      remove: (u, id) => purchaseRequest.remove(u, id),
    },
    {
      entity: PurchaseOrder,
      idField: 'orderId',
      list: async (u) => (await purchaseOrder.findAll(u)).items,
      get: (u, id) => purchaseOrder.findOne(u, id),
      remove: (u, id) => purchaseOrder.remove(u, id),
    },
    {
      entity: InventoryDocument,
      idField: 'inventoryDocumentId',
      list: async (u) => (await inventory.list(u)).items,
      get: (u, id) => inventory.get(u, id),
      remove: (u, id) => inventory.cancel(u, id, '검증'),
    },
  ];
  for (const companyId of ['A', 'B']) {
    for (const [deptId, parentDeptId] of [
      ['D1', null],
      ['D2', 'D1'],
      ['D3', null],
    ] as const)
      await seed(Department, {
        companyId,
        deptId,
        parentDeptId,
        name: deptId,
        createdBy: 'owner',
      });
    for (const document of documents)
      for (const [id, siteId, deptId, deleteYn] of [
        ['ROOT', 'S1', 'D1', 'N'],
        ['CHILD', 'S1', 'D2', 'N'],
        ['OTHER', 'S2', 'D3', 'N'],
        ['DELETED', 'S1', 'D1', 'Y'],
      ])
        await seed(document.entity, {
          companyId,
          [document.idField]: id,
          siteId,
          deptId,
          deleteYn,
          createdBy: 'owner',
          status: 'D',
          orderKind: 'PLAN',
        });
  }
  await seed(Equipment, {
    companyId: 'A',
    equipmentId: 'EQ',
    siteId: 'S1',
    deptId: 'D1',
    createdBy: 'owner',
  });
});
afterAll(async () => {
  if (close) await close();
});

describe.each([
  'pmId',
  'workRequestId',
  'workOrderId',
  'workPermitRequestId',
  'workPermitId',
  'requestId',
  'orderId',
  'inventoryDocumentId',
])('%s document policy', (idField) => {
  const api = () => documents.find((document) => document.idField === idField)!;
  it('isolates companies even when document IDs match and excludes deleted rows', async () => {
    expect(
      (await api().list(actor()))
        .map((row) => row[idField])
        .sort((left, right) => String(left).localeCompare(String(right))),
    ).toEqual(['CHILD', 'OTHER', 'ROOT']);
    expect((await api().get(actor({ companyId: 'B' }), 'ROOT')).companyId).toBe(
      'B',
    );
    await expect(api().get(actor(), 'DELETED')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('applies site and descendant-department conditions to lists and individual reads', async () => {
    for (const user of [
      actor({ accessScope: 'OWN_SITE' }),
      actor({ accessScope: 'OWN_DEPARTMENT' }),
    ]) {
      expect(
        (await api().list(user))
          .map((row) => row[idField])
          .sort((left, right) => String(left).localeCompare(String(right))),
      ).toEqual(['CHILD', 'ROOT']);
      await expect(api().get(user, 'OTHER')).rejects.toMatchObject({
        status: 404,
      });
      await expect(api().remove(user, 'OTHER')).rejects.toMatchObject({
        status: 404,
      });
    }
    expect(
      (await api().list(actor({ accessScope: 'OWN_DEPARTMENT', deptId: 'D2' })))
        .map((row) => row[idField])
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(
      idField === 'inventoryDocumentId' ? ['CHILD', 'ROOT'] : ['CHILD'],
    );
  });
  it('rejects missing affiliation rather than falling back to company-wide access', async () => {
    await expect(
      Promise.resolve().then(() =>
        api().list(actor({ accessScope: 'OWN_SITE', siteId: null })),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      Promise.resolve().then(() =>
        api().list(
          actor({
            accessScope: 'OWN_DEPARTMENT',
            deptId: '',
            ...(idField === 'inventoryDocumentId' ? { siteId: null } : {}),
          }),
        ),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

it('stores the PM selected department, server site and audit fields without validating the input department against scope', async () => {
  const user = actor({ accessScope: 'OWN_DEPARTMENT' });
  const saved = await pm.create(user, {
    pmId: 'NEW',
    inspectionDate: '20261115',
    equipmentId: 'EQ',
    title: '점검',
    deptId: 'D2',
  });
  expect(saved).toMatchObject({
    companyId: 'A',
    siteId: 'S1',
    deptId: 'D2',
    createdBy: 'owner',
    deptName: 'D2',
  });
  expect(saved).not.toHaveProperty('inspectionDeptId');
  expect((await pm.update(user, 'NEW', { deptId: 'D3' })).deptId).toBe('D3');
  await pm.create(user, {
    pmId: 'OUTSIDE',
    inspectionDate: '20261115',
    equipmentId: 'EQ',
    title: '범위 밖 입력',
    deptId: 'D3',
  });
  await expect(pm.findOne(user, 'OUTSIDE')).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    pm.findOne(actor({ companyId: 'B' }), 'NEW'),
  ).rejects.toMatchObject({ status: 404 });
});

it('paginates PM summaries with company isolation and literal document/equipment search', async () => {
  for (let i = 0; i < 23; i++)
    await seed(PreventiveMaintenance, {
      companyId: 'C',
      pmId: `PM-${String(i).padStart(3, '0')}`,
      documentNo: i === 0 ? '관리%_번호' : '',
      title: `점검 ${i}`,
      equipmentId: i === 1 ? 'EQ-SPECIAL' : 'EQ',
      siteId: 'S1',
      deptId: 'D1',
      inspectorId: 'owner',
      inspectionDate: '20261115',
      deleteYn: i === 22 ? 'Y' : 'N',
      createdAt: new Date('2026-11-15T00:00:00Z'),
      items: [
        { name: '상세', standardValue: '', inspectionValue: '', unit: '' },
      ],
      content: '본문',
      createdBy: 'owner',
      status: 'D',
    });
  const user = actor({ companyId: 'C' });
  const first = await pm.findAll(user, { page: 1, limit: 20 });
  const second = await pm.findAll(user, { page: 2, limit: 20 });
  expect(first).toMatchObject({ total: 22, page: 1, limit: 20 });
  expect(first.items).toHaveLength(20);
  expect(second.items).toHaveLength(2);
  expect(first.items[0].pmId).toBe('PM-021');
  expect(first.items[0]).not.toHaveProperty('content');
  expect(first.items[0]).not.toHaveProperty('items');
  for (const search of ['관리%_', 'PM-000'])
    expect((await pm.findAll(user, { search })).total).toBe(1);
  expect((await pm.findAll(user, { search: 'EQ-SPECIAL' })).items[0].pmId).toBe(
    'PM-001',
  );
  expect((await pm.findAll(actor(), { search: 'EQ-SPECIAL' })).total).toBe(0);
});

it('matches PM varchar DTO lengths and requires real inspection date input', () => {
  const excluded = new Set([
    'companyId',
    'siteId',
    'requesterId',
    'status',
    'createdBy',
    'updatedBy',
    'deleteYn',
  ]);
  for (const column of db.getMetadata(PreventiveMaintenance).columns) {
    if (column.type !== 'varchar' || excluded.has(column.propertyName))
      continue;
    for (const dto of [
      CreatePreventiveMaintenanceDto,
      UpdatePreventiveMaintenanceDto,
    ]) {
      if (
        dto === UpdatePreventiveMaintenanceDto &&
        column.propertyName === 'pmId'
      )
        continue;
      const errors = validateSync(
        plainToInstance(dto, {
          title: '점검',
          equipmentId: 'EQ',
          inspectionDate: '20261115',
          [column.propertyName]: 'x'.repeat(Number(column.length) + 1),
        }),
      );
      expect(
        errors.find((e) => e.property === column.propertyName),
      ).toBeDefined();
    }
  }
  for (const inspectionDate of [null, '', undefined]) {
    expect(
      validateSync(
        plainToInstance(CreatePreventiveMaintenanceDto, {
          title: '점검',
          equipmentId: 'EQ',
          inspectionDate,
        }),
      ).some((e) => e.property === 'inspectionDate'),
    ).toBe(true);
  }
  expect(
    validateSync(
      plainToInstance(UpdatePreventiveMaintenanceDto, { inspectionDate: null }),
    ).some((e) => e.property === 'inspectionDate'),
  ).toBe(true);
});

it('paginates request and order summaries with literal four-field search and preserves order totals', async () => {
  const request = new WorkRequestService(
    db.getRepository(WorkRequest),
    db.getRepository(Equipment),
  );
  const order = new WorkOrderService(
    db.getRepository(WorkOrder),
    db.getRepository(Equipment),
    request,
  );
  const user = actor({ companyId: 'LIST' });
  for (let i = 0; i < 23; i++) {
    const common = {
      companyId: 'LIST',
      documentNo: i === 0 ? '관리%_번호' : '',
      title: `테스트 ${i}`,
      equipmentId: i === 1 ? 'EQ-SPECIAL' : 'EQ',
      siteId: 'S1',
      deptId: 'D1',
      createdBy: 'owner',
      status: 'D',
      deleteYn: i === 22 ? 'Y' : 'N',
      createdAt: new Date('2026-11-15T00:00:00Z'),
      content: '본문',
      note: '비고',
    };
    await seed(WorkRequest, {
      ...common,
      workRequestId: `REQ-${String(i).padStart(3, '0')}`,
      occurredDate: '20261115',
    });
    await seed(WorkOrder, {
      ...common,
      workOrderId: `ORD-${String(i).padStart(3, '0')}`,
      orderKind: i % 2 ? 'ACTUAL' : 'PLAN',
      workDate: '20261115',
      laborItems: [],
      materials: [
        {
          name: '자재',
          spec: '',
          quantity: 2,
          unit: 'EA',
          unitPrice: 3,
          amount: 6,
        },
      ],
      costItems: [{ name: '기타', amount: 4, note: '' }],
    });
  }
  for (const [api, prefix] of [
    [request, 'REQ'],
    [order, 'ORD'],
  ] as const) {
    const first = await api.findAll(user, { page: 1, limit: 20 });
    const second = await api.findAll(user, { page: 2, limit: 20 });
    expect(first.total).toBe(22);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(2);
    expect(first.items[0]).not.toHaveProperty('content');
    expect(first.items[0]).not.toHaveProperty('note');
    expect((await api.findAll(user, { search: '없는문서' })).total).toBe(0);
    for (const search of ['관리%_', `${prefix}-000`, 'EQ-SPECIAL'])
      expect((await api.findAll(user, { search })).total).toBe(1);
    expect((await api.findAll(actor(), { search: 'EQ-SPECIAL' })).total).toBe(
      0,
    );
  }
  const row = (await order.findAll(user)).items[0];
  expect(row.totalCost).toBe(10);
  expect(row).not.toHaveProperty('materials');
  expect(row).not.toHaveProperty('laborItems');
});

it('only offers confirmed plans and checks their status again when submitting an actual', async () => {
  const request = new WorkRequestService(
    db.getRepository(WorkRequest),
    db.getRepository(Equipment),
  );
  const order = new WorkOrderService(
    db.getRepository(WorkOrder),
    db.getRepository(Equipment),
    request,
  );
  const user = actor({ companyId: 'REF' });
  await seed(Equipment, {
    companyId: 'REF',
    equipmentId: 'EQ',
    siteId: 'S1',
    deptId: 'D1',
    createdBy: 'owner',
  });
  for (const status of ['D', 'P', 'C', 'R', 'X'])
    await seed(WorkOrder, {
      companyId: 'REF',
      workOrderId: `PLAN-${status}`,
      orderKind: 'PLAN',
      siteId: 'S1',
      deptId: 'D1',
      createdBy: 'owner',
      deleteYn: 'N',
      status,
      refId: null,
      refModule: null,
    });
  expect(
    (await order.getOptions(user)).plans.map((plan) => plan.workOrderId),
  ).toEqual(['PLAN-C']);
  const input = {
    workOrderId: 'ACTUAL',
    orderKind: 'ACTUAL' as const,
    title: '실적',
    equipmentId: 'EQ',
    workDate: '20261115',
    refModule: 'WRKORD',
    refId: 'PLAN-C',
  };
  for (const status of ['D', 'P', 'R', 'X'])
    await expect(
      order.create(user, { ...input, refId: `PLAN-${status}` }),
    ).rejects.toThrow('완결된');
  await order.create(user, input);
  await order.assertCanSubmit(user, 'ACTUAL');
  await db
    .getRepository(WorkOrder)
    .update({ companyId: 'REF', workOrderId: 'PLAN-C' }, { status: 'D' });
  await expect(order.assertCanSubmit(user, 'ACTUAL')).rejects.toThrow('완결된');
});

it('paginates permit summaries and searches IDs, management numbers and titles but not equipment references', async () => {
  const request = new WorkPermitRequestService(
    db.getRepository(WorkPermitRequest),
  );
  const permit = new WorkPermitService(db.getRepository(WorkPermit), request);
  const user = actor({ companyId: 'PERMLIST' });
  for (let i = 0; i < 23; i++) {
    const common = {
      companyId: 'PERMLIST',
      documentNo: i === 0 ? '관리%_번호' : '',
      data: {
        title: `허가 ${i}`,
        applicantName: '신청자',
        equipmentNo: '검색제외설비',
      },
      siteId: 'S1',
      deptId: 'D1',
      createdAt: new Date('2026-11-15T00:00:00Z'),
      createdBy: 'owner',
      status: 'D',
      deleteYn: i === 22 ? 'Y' : 'N',
    };
    await seed(WorkPermitRequest, {
      ...common,
      workPermitRequestId: `REQUEST-${String(i).padStart(3, '0')}`,
    });
    await seed(WorkPermit, {
      ...common,
      workPermitId: `PERMIT-${String(i).padStart(3, '0')}`,
      issuerId: 'owner',
      approverId: 'other',
      sections: [{ type: 'GENERAL' }],
      permitTypes: ['GENERAL'],
    });
  }
  for (const [service, id] of [
    [request, 'REQUEST-000'],
    [permit, 'PERMIT-000'],
  ] as const) {
    const first = await service.findAll(user, { limit: 20 });
    expect(first.total).toBe(22);
    expect(first.items).toHaveLength(20);
    expect(
      (await service.findAll(user, { page: 2, limit: 20 })).items,
    ).toHaveLength(2);
    expect(first.items[0]).not.toHaveProperty('data');
    expect(first.items[0]).not.toHaveProperty('sections');
    for (const search of ['관리%_', id])
      expect((await service.findAll(user, { search })).total).toBe(1);
    expect(
      (await service.findAll(user, { search: '검색제외설비' })).total,
    ).toBe(0);
    expect((await service.findAll(actor(), { search: id })).total).toBe(0);
  }
});

it('keeps deleted permit issuer IDs without resolving names until the same-company user is restored', async () => {
  await seed(User, {
    companyId: 'HISTORY',
    userId: 'OLD',
    name: '과거 발급자',
    deleteYn: 'Y',
  });
  await seed(User, {
    companyId: 'OTHER',
    userId: 'OLD',
    name: '다른 회사 이름',
    deleteYn: 'N',
  });
  await seed(WorkPermit, {
    companyId: 'HISTORY',
    workPermitId: 'OLD-PERMIT',
    issuerId: 'OLD',
    approverId: 'OTHER-USER',
    status: 'C',
    createdBy: 'owner',
    deleteYn: 'N',
  });
  const service = new WorkPermitService(
    db.getRepository(WorkPermit),
    new WorkPermitRequestService(db.getRepository(WorkPermitRequest)),
  );
  expect(
    (await service.findOne(actor({ companyId: 'HISTORY' }), 'OLD-PERMIT'))
      .issuerName,
  ).toBeNull();
  expect(
    (await service.findOne(actor({ companyId: 'HISTORY' }), 'OLD-PERMIT'))
      .issuerId,
  ).toBe('OLD');
  await db
    .getRepository(User)
    .update({ companyId: 'HISTORY', userId: 'OLD' }, { deleteYn: 'N' });
  expect(
    (await service.findOne(actor({ companyId: 'HISTORY' }), 'OLD-PERMIT'))
      .issuerName,
  ).toBe('과거 발급자');
});
