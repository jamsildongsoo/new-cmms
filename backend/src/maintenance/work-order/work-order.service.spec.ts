import { WorkRequestService } from '../work-request/work-request.service';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserContext } from '../../auth/types/user-context.type';
import { Equipment } from '../equipment/entities/equipment.entity';
import { WorkOrder } from './entities/work-order.entity';
import { WorkOrderService } from './work-order.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { materialAmount } from './work-order-totals';

const actor = (overrides: Partial<UserContext> = {}) =>
  ({
    companyId: 'A',
    userId: 'owner',
    siteId: 'S1',
    deptId: 'D1',
    accessScope: 'COMPANY_ALL',
    ...overrides,
  }) as UserContext;
function fixture() {
  const plan = {
    companyId: 'A',
    workOrderId: 'plan',
    orderKind: 'PLAN',
    refModule: null,
    refId: null,
    title: '계획',
    equipmentId: 'EQ',
    workDate: '20261105',
    siteId: 'S1',
    deptId: 'D1',
    status: 'C',
    createdBy: 'owner',
    deleteYn: 'N',
    laborItems: [],
    materials: [],
    costItems: [],
  } as unknown as WorkOrder;
  const rows = [plan];
  const queries: { sql: string[]; params: Record<string, unknown> }[] = [];
  const repository = {
    create: (value: WorkOrder) => value,
    save: jest.fn(async (value: WorkOrder) => {
      const index = rows.findIndex(
        (row) =>
          row.workOrderId === value.workOrderId &&
          row.companyId === value.companyId,
      );
      if (index < 0) rows.push(value);
      else rows[index] = value;
      return value;
    }),
    findOneBy: jest.fn(
      async (where: Partial<WorkOrder>) =>
        rows.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof WorkOrder] === value,
          ),
        ) ?? null,
    ),
    manager: { getRepository: () => ({ find: async () => [] }) },
    createQueryBuilder: () => {
      const query = {
        sql: [] as string[],
        params: {} as Record<string, unknown>,
      };
      queries.push(query);
      const filtered = () =>
        rows.filter(
          (row) =>
            row.companyId === query.params.companyId &&
            row.deleteYn === 'N' &&
            (!query.params.id || row.workOrderId === query.params.id) &&
            (!query.params.scopeSiteId ||
              row.siteId === query.params.scopeSiteId) &&
            (!query.params.scopeDeptId ||
              [query.params.scopeDeptId, 'CHILD'].some(
                (deptId) => deptId === row.deptId,
              )) &&
            (!query.params.kind || row.orderKind === query.params.kind) &&
            (!query.params.planStatus ||
              row.status === query.params.planStatus),
        );
      const builder = {
        where: (sql: string, params: Record<string, unknown>) => {
          query.sql = [sql];
          Object.assign(query.params, params);
          return builder;
        },
        andWhere: (sql: string, params: Record<string, unknown> = {}) => {
          query.sql.push(sql);
          Object.assign(query.params, params);
          return builder;
        },
        orderBy: () => builder,
        select: () => builder,
        addOrderBy: () => builder,
        skip: () => builder,
        take: () => builder,
        getManyAndCount: async () => [filtered(), filtered().length],
        getOne: async () => filtered()[0] ?? null,
        getMany: async () => filtered(),
      };
      return builder;
    },
  };
  const equipment = {
    findOneBy: jest.fn(async () => ({ equipmentId: 'EQ' })),
    find: async () => [],
  };
  const requests = {
    listForPlan: jest.fn(async () => []),
    findForPlan: jest.fn(async () => ({
      workRequestId: 'request',
      status: 'C',
    })),
  };
  const service = new WorkOrderService(
    repository as unknown as Repository<WorkOrder>,
    equipment as unknown as Repository<Equipment>,
    requests as unknown as WorkRequestService,
  );
  const input = (workOrderId: string) => ({
    workOrderId,
    title: '실적',
    orderKind: 'ACTUAL' as const,
    refModule: 'WRKORD',
    refId: 'plan',
    equipmentId: 'EQ',
    workDate: '20261105',
  });
  return {
    service,
    repository,
    equipment,
    plan,
    rows,
    queries,
    input,
    requests,
  };
}

describe('Work order independent documents', () => {
  it('uses common references for multiple plans based on one work request or standalone plans', async () => {
    const { service, input, requests } = fixture();
    const based = {
      ...input('p1'),
      orderKind: 'PLAN' as const,
      refModule: 'WRKREQ',
      refId: 'request',
    };
    expect((await service.create(actor(), based)).refId).toBe('request');
    expect(
      (await service.create(actor(), { ...based, workOrderId: 'p2' })).refId,
    ).toBe('request');
    expect(
      (
        await service.create(actor(), {
          ...based,
          workOrderId: 'standalone',
          refModule: null,
          refId: null,
        })
      ).refId,
    ).toBeNull();
    expect(requests.findForPlan).toHaveBeenCalledWith(actor(), 'request');
    const updated = await service.update(actor(), 'p1', {
      refModule: null,
      refId: null,
    });
    expect(updated.refModule).toBeNull();
    expect(updated).not.toHaveProperty('planId');
  });
  it('rejects incomplete references and request references on actuals before save', async () => {
    const { service, input, repository, requests } = fixture();
    await expect(
      service.create(actor(), { ...input('bad'), refId: null }),
    ).rejects.toThrow('provided together');
    await expect(
      service.create(actor(), { ...input('bad'), refModule: 'WRKREQ' }),
    ).rejects.toThrow('Actual work can only reference');
    requests.findForPlan.mockRejectedValueOnce(
      new Error('Only confirmed work requests') as never,
    );
    await expect(
      service.create(actor(), {
        ...input('bad'),
        orderKind: 'PLAN',
        refModule: 'WRKREQ',
        refId: 'draft',
      }),
    ).rejects.toThrow('Only confirmed');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('stores and updates the source attachment group and retains it when all items are removed', async () => {
    const { service, input } = fixture();
    expect(
      (await service.create(actor(), { ...input('a'), attachmentId: 'files' }))
        .attachmentId,
    ).toBe('files');
    expect(
      (
        await service.update(actor(), 'a', {
          note: '파일 항목만 삭제한 뒤 저장',
        })
      ).attachmentId,
    ).toBe('files');
    expect(
      (await service.update(actor(), 'a', { attachmentId: 'new-files' }))
        .attachmentId,
    ).toBe('new-files');
  });

  it('allows multiple actuals against a confirmed plan without changing that plan', async () => {
    const { service, input, rows, plan } = fixture();
    const first = await service.create(actor(), input('actual-1'));
    const second = await service.create(actor(), input('actual-2'));
    expect(rows).toHaveLength(3);
    expect(first.refId).toBe(second.refId);
    expect(first.documentNo).toBe('');
    expect(first).toMatchObject({
      siteId: 'S1',
      deptId: 'D1',
      createdBy: 'owner',
      status: 'D',
      deleteYn: 'N',
    });
    expect(plan.status).toBe('C');
    expect(first.attachmentId).toBeNull();
  });
  it('supports actual work without any plan', async () => {
    const { service, input } = fixture();
    expect(
      (
        await service.create(actor(), {
          ...input('actual'),
          refModule: null,
          refId: null,
        })
      ).refId,
    ).toBeNull();
  });
  it('rejects a plan referencing another plan and an actual referencing another actual', async () => {
    const { service, input, plan } = fixture();
    await expect(
      service.create(actor(), { ...input('p2'), orderKind: 'PLAN' }),
    ).rejects.toThrow('Plans can only reference');
    plan.orderKind = 'ACTUAL';
    await expect(service.create(actor(), input('a2'))).rejects.toThrow(
      'must be a plan',
    );
  });
  it('calculates multiple materials, hours and whole-won costs on the server', async () => {
    const { service, input } = fixture();
    const saved = await service.create(actor(), {
      ...input('a'),
      laborItems: [
        { workerName: '홍길동', hours: 2.5 },
        { workerName: '김철수', hours: 1 },
      ],
      materials: [
        { name: '베어링', quantity: 2, unitPrice: 10000 },
        { name: '윤활유', quantity: 3, unitPrice: 5000 },
      ],
      costItems: [{ name: '외주비', amount: 100000 }],
    });
    expect(saved.materials.map((r) => r.amount)).toEqual([20000, 15000]);
    expect(saved).toMatchObject({
      totalHours: 3.5,
      materialTotal: 35000,
      costTotal: 100000,
      totalCost: 135000,
    });
    expect(materialAmount(0.5, 1)).toBe(1);
    expect(materialAmount(1.0005, 1000)).toBe(1001);
  });
  it('rejects negative, non-finite or excessive amounts before saving', async () => {
    const { service, input, repository } = fixture();
    for (const quantity of [
      -1,
      NaN,
      Infinity,
      0.00001,
      Number.MAX_SAFE_INTEGER,
    ]) {
      await expect(
        service.create(actor(), {
          ...input(`bad${quantity}`),
          materials: [{ name: '자재', quantity, unitPrice: 2 }],
        }),
      ).rejects.toThrow();
    }
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('keeps document affiliation and allows clearing all detail arrays', async () => {
    const { service, plan } = fixture();
    plan.status = 'D';
    plan.laborItems = [{ workerName: '홍길동', content: '', hours: 1 }];
    const saved = await service.update(
      actor({ siteId: 'S2', deptId: 'D2' }),
      'plan',
      { laborItems: [], materials: [], costItems: [] },
    );
    expect(saved).toMatchObject({
      siteId: 'S1',
      deptId: 'D1',
      laborItems: [],
      materials: [],
      costItems: [],
      totalCost: 0,
      updatedBy: 'owner',
    });
  });
  it('only allows the owner to update or soft delete a draft', async () => {
    const { service, plan } = fixture();
    plan.status = 'D';
    await expect(
      service.update(actor({ userId: 'other' }), 'plan', { title: '수정' }),
    ).rejects.toThrow('Only the owner');
    await expect(
      service.remove(actor({ userId: 'other' }), 'plan'),
    ).rejects.toThrow('Only the owner');
    plan.status = 'P';
    await expect(
      service.update(actor(), 'plan', { title: '수정' }),
    ).rejects.toThrow('Only draft');
    await expect(service.remove(actor(), 'plan')).rejects.toThrow('Only draft');
    plan.status = 'D';
    expect((await service.remove(actor(), 'plan')).deleteYn).toBe('Y');
  });
  it('checks owner, draft and document scope before a linked approval can submit', async () => {
    const { service, plan } = fixture();
    plan.status = 'D';
    await expect(
      service.assertCanSubmit(actor({ userId: 'other' }), 'plan'),
    ).rejects.toThrow('Only the owner');
    await expect(
      service.assertCanSubmit(
        actor({ accessScope: 'OWN_SITE', siteId: 'S2' }),
        'plan',
      ),
    ).rejects.toThrow('not found');
    plan.status = 'C';
    await expect(service.assertCanSubmit(actor(), 'plan')).rejects.toThrow(
      'Only draft',
    );
  });

  it('validates calendar dates as well as the YYYYMMDD format', async () => {
    const { service, input } = fixture();
    await expect(
      service.create(actor(), { ...input('a'), workDate: '20260229' }),
    ).rejects.toThrow('valid date');
    await expect(
      service.create(actor(), { ...input('a'), workDate: '2026-01-01' }),
    ).rejects.toThrow('YYYYMMDD');
  });
  it.each(['P', 'C', 'R', 'X'] as const)(
    'syncs only the referenced actual to %s',
    async (status) => {
      const { service, input, plan } = fixture();
      await service.create(actor(), input('a'));
      await service.syncApprovalStatus('A', 'a', status, 'approver');
      expect((await service.findOne(actor(), 'a')).status).toBe(status);
      expect(plan.status).toBe('C');
      await expect(
        service.syncApprovalStatus('B', 'a', status, 'approver'),
      ).rejects.toThrow('not found');
    },
  );
});

describe('Work order document access', () => {
  it('hides other-company and out-of-site records from reads, edits and plan selection', async () => {
    const { service, input } = fixture();
    expect((await service.findAll(actor({ companyId: 'B' }))).items).toEqual(
      [],
    );
    for (const user of [
      actor({ companyId: 'B' }),
      actor({ accessScope: 'OWN_SITE', siteId: 'S2' }),
    ]) {
      await expect(service.findOne(user, 'plan')).rejects.toThrow('not found');
      await expect(
        service.update(user, 'plan', { title: '수정' }),
      ).rejects.toThrow('not found');
      await expect(service.remove(user, 'plan')).rejects.toThrow('not found');
      await expect(service.create(user, input('a'))).rejects.toThrow(
        'not found',
      );
      expect((await service.getOptions(user)).plans).toEqual([]);
    }
  });
  it('includes subordinate departments and retains scope predicates when searching', async () => {
    const { service, plan, queries } = fixture();
    plan.deptId = 'CHILD';
    const result = (
      await service.findAll(actor({ accessScope: 'OWN_DEPARTMENT' }), {
        search: '계획',
      })
    ).items;
    expect(result).toHaveLength(1);
    expect(queries[0].sql.join(' ')).toContain('WITH RECURSIVE');
    expect(queries[0].sql[0]).toContain('companyId');
    expect(queries[0].params).toMatchObject({
      companyId: 'A',
      scopeDeptId: 'D1',
      search: '%계획%',
    });
  });
  it('fails closed when a restricted scope has no required affiliation', async () => {
    const { service } = fixture();
    await expect(
      service.findAll(actor({ accessScope: 'OWN_SITE', siteId: null })),
    ).rejects.toThrow('scope or affiliation');
    await expect(
      service.findAll(actor({ accessScope: 'OWN_DEPARTMENT', deptId: '' })),
    ).rejects.toThrow('scope or affiliation');
  });
});

describe('Work order request contracts', () => {
  it('accepts an optional management number and validates nested numeric rows', async () => {
    const valid = plainToInstance(CreateWorkOrderDto, {
      workOrderId: 'e6c2f691-e88a-4f82-9868-2db8f2d52b18',
      title: '정비',
      orderKind: 'PLAN',
      equipmentId: 'EQ',
      workDate: '20261105',
      laborItems: [{ workerName: '홍길동', hours: 2.5 }],
      materials: [{ name: '윤활유', quantity: 0.5, unitPrice: 1000 }],
      costItems: [],
    });
    expect(
      await validate(valid, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    valid.materials![0].quantity = -1;
    expect(await validate(valid)).not.toHaveLength(0);
  });

  it('rejects editing kind, client-calculated amounts, ownership or affiliation', async () => {
    const dto = plainToInstance(UpdateWorkOrderDto, {
      orderKind: 'ACTUAL',
      siteId: 'foreign',
      createdBy: 'other',
      materials: [{ name: '자재', quantity: 1, unitPrice: 1, amount: 0 }],
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['orderKind', 'siteId', 'createdBy', 'materials']),
    );
  });
});

class OfflineSource extends DataSource {
  prepare() {
    return this.buildMetadatas();
  }
}
it('generates PostgreSQL department-scope SQL with bound company, search and department values', async () => {
  const source = new OfflineSource({ type: 'postgres', entities: [WorkOrder] });
  await source.prepare();
  const repository = source.getRepository(WorkOrder);
  const original = repository.createQueryBuilder.bind(repository);
  let generated: SelectQueryBuilder<WorkOrder> | undefined;
  jest.spyOn(repository, 'createQueryBuilder').mockImplementation((alias) => {
    generated = original(alias);
    jest.spyOn(generated, 'getManyAndCount').mockResolvedValue([[], 0]);
    return generated;
  });
  await new WorkOrderService(
    repository,
    {} as Repository<Equipment>,
    {} as WorkRequestService,
  ).findAll(actor({ accessScope: 'OWN_DEPARTMENT' }), {
    search: "x' OR 1=1",
  });
  const [sql, params] = generated!.getQueryAndParameters();
  expect(sql).toContain('"wo"."deptId" IN');
  expect(sql).toContain('WITH RECURSIVE');
  expect(sql).not.toContain("x' OR 1=1");
  expect(params).toEqual(expect.arrayContaining(['A', 'D1', "%x' OR 1=1%"]));
});

it('applies common precision to new work-order material quantities and prices', async () => {
  const { service, input } = fixture();
  await expect(
    service.create(actor(), {
      ...input('precision'),
      materials: [{ name: '자재', quantity: 1.234, unitPrice: 10 }],
    }),
  ).rejects.toThrow('소수점 2자리');
  await expect(
    service.create(actor(), {
      ...input('precision'),
      materials: [{ name: '자재', quantity: 1.23, unitPrice: 10.5 }],
    }),
  ).rejects.toThrow('소수점 0자리');
});
