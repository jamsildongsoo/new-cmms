import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserContext } from '../../auth/types/user-context.type';
import { Equipment } from '../equipment/entities/equipment.entity';
import { WorkOrder } from '../work-order/entities/work-order.entity';
import { WorkRequest } from './entities/work-request.entity';
import { WorkRequestService } from './work-request.service';
import { CreateWorkRequestDto } from './dto/create-work-request.dto';

const actor = (overrides: Partial<UserContext> = {}) =>
  ({
    companyId: 'A',
    userId: 'owner',
    siteId: 'S',
    deptId: 'D',
    accessScope: 'COMPANY_ALL',
    permissions: ['work_request:read', 'work_order:read'],
    ...overrides,
  }) as UserContext;
function fixture() {
  const request = {
    companyId: 'A',
    workRequestId: 'request',
    documentNo: '',
    title: '소음 발생',
    equipmentId: 'EQ',
    occurredDate: '20261105',
    content: '펌프 소음',
    priorityCode: null,
    note: null,
    attachmentId: 'files',
    requesterId: 'owner',
    createdBy: 'owner',
    siteId: 'S',
    deptId: 'D',
    status: 'D',
    deleteYn: 'N',
  } as WorkRequest;
  const rows = [request];
  const plans = [
    {
      companyId: 'A',
      workOrderId: 'plan1',
      orderKind: 'PLAN',
      refModule: 'work_request',
      refId: 'request',
      siteId: 'S',
      deptId: 'D',
      deleteYn: 'N',
    },
    {
      companyId: 'A',
      workOrderId: 'plan2',
      orderKind: 'PLAN',
      refModule: 'work_request',
      refId: 'request',
      siteId: 'S',
      deptId: 'CHILD',
      deleteYn: 'N',
    },
    {
      companyId: 'B',
      workOrderId: 'foreign',
      orderKind: 'PLAN',
      refModule: 'work_request',
      refId: 'request',
      siteId: 'S',
      deptId: 'D',
      deleteYn: 'N',
    },
  ];
  const queries: { sql: string[]; params: Record<string, unknown> }[] = [];
  const builder = (data: object[], idField: string) => {
    const q = { sql: [] as string[], params: {} as Record<string, unknown> };
    queries.push(q);
    const matches = () =>
      data.filter((value) => {
        const r = value as Record<string, unknown>,
          p = q.params;
        return (
          r.companyId === p.companyId &&
          r.deleteYn === 'N' &&
          (!p.id ||
            r[q.sql.some((s) => s.includes('.refId')) ? 'refId' : idField] ===
              p.id) &&
          (!p.scopeSiteId || r.siteId === p.scopeSiteId) &&
          (!p.scopeDeptId || [p.scopeDeptId, 'CHILD'].includes(r.deptId)) &&
          (!p.status || r.status === p.status) &&
          (!p.kind || r.orderKind === p.kind) &&
          (!p.module || r.refModule === p.module)
        );
      });
    const b = {
      where: (sql: string, params: object) => {
        q.sql = [sql];
        Object.assign(q.params, params);
        return b;
      },
      andWhere: (sql: string, params: object = {}) => {
        q.sql.push(sql);
        Object.assign(q.params, params);
        return b;
      },
      select: () => b,
      orderBy: () => b,
      getOne: async () => matches()[0] ?? null,
      getMany: async () => matches(),
    };
    return b;
  };
  const codeItems = {
    find: jest.fn(async () => [{ codeItemId: 'URGENT', name: '긴급' }]),
  };
  const repository = {
    create: (row: WorkRequest) => row,
    save: jest.fn(async (row: WorkRequest) => row),
    findOneBy: jest.fn(
      async (where: Partial<WorkRequest>) =>
        rows.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof WorkRequest] === value,
          ),
        ) ?? null,
    ),
    createQueryBuilder: () => builder(rows, 'workRequestId'),
    manager: {
      getRepository: (entity: unknown) =>
        entity === WorkOrder
          ? { createQueryBuilder: () => builder(plans, 'workOrderId') }
          : codeItems,
    },
  };
  const equipment = {
    find: jest.fn(async () => [{ equipmentId: 'EQ', name: '펌프' }]),
    findOneBy: jest.fn(async () => ({ equipmentId: 'EQ' }) as Equipment | null),
  };
  return {
    request,
    repository,
    equipment,
    queries,
    codeItems,
    service: new WorkRequestService(
      repository as unknown as Repository<WorkRequest>,
      equipment as unknown as Repository<Equipment>,
    ),
  };
}
const input = {
  workRequestId: 'new',
  title: '고장 의뢰',
  equipmentId: 'EQ',
  occurredDate: '20261105',
  content: '진동 발생',
  attachmentId: 'new-files',
};

describe('Work request lifecycle', () => {
  it('creates an owner draft with optional management number and source attachments', async () => {
    const { service, equipment } = fixture();
    expect(await service.create(actor(), input)).toMatchObject({
      documentNo: '',
      status: 'D',
      companyId: 'A',
      createdBy: 'owner',
      requesterId: 'owner',
      siteId: 'S',
      deptId: 'D',
      attachmentId: 'new-files',
      deleteYn: 'N',
    });
    expect(equipment.findOneBy).toHaveBeenCalledWith({
      companyId: 'A',
      equipmentId: 'EQ',
      deleteYn: 'N',
    });
  });
  it('preserves old affiliation and attachment ID on unrelated edits', async () => {
    const { service } = fixture();
    expect(
      await service.update(actor({ siteId: 'NEW', deptId: 'NEW' }), 'request', {
        title: '수정',
      }),
    ).toMatchObject({
      title: '수정',
      siteId: 'S',
      deptId: 'D',
      attachmentId: 'files',
      updatedBy: 'owner',
    });
  });
  it('rejects non-owner and non-draft edits, deletes and linked submissions', async () => {
    const { service, request } = fixture();
    await expect(
      service.update(actor({ userId: 'other' }), 'request', { title: '수정' }),
    ).rejects.toThrow('Only the owner');
    await expect(
      service.remove(actor({ userId: 'other' }), 'request'),
    ).rejects.toThrow('Only the owner');
    await expect(
      service.assertCanSubmit(actor({ userId: 'other' }), 'request'),
    ).rejects.toThrow('Only the owner');
    request.status = 'C';
    await expect(
      service.update(actor(), 'request', { title: '수정' }),
    ).rejects.toThrow('Only draft');
    await expect(service.remove(actor(), 'request')).rejects.toThrow(
      'Only draft',
    );
    await expect(service.assertCanSubmit(actor(), 'request')).rejects.toThrow(
      'Only draft',
    );
  });
  it('soft deletes owner drafts and keeps file groups', async () => {
    const { service } = fixture();
    expect(await service.remove(actor(), 'request')).toMatchObject({
      deleteYn: 'Y',
      attachmentId: 'files',
      updatedBy: 'owner',
    });
  });
  it.each(['20260229', '20260431', '2026-11-05'])(
    'rejects invalid occurrence date %s before save',
    async (occurredDate) => {
      const { service, repository } = fixture();
      await expect(
        service.create(actor(), { ...input, occurredDate }),
      ).rejects.toThrow();
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  it('rejects missing or other-company equipment', async () => {
    const { service, equipment } = fixture();
    equipment.findOneBy.mockResolvedValue(null);
    await expect(service.create(actor(), input)).rejects.toThrow(
      'Equipment not found',
    );
  });
  it.each(['P', 'C', 'R', 'X'] as const)(
    'syncs %s without updating any work plans or equipment',
    async (status) => {
      const { service, request, equipment } = fixture();
      await service.syncApprovalStatus('A', 'request', status, 'approver');
      expect(request).toMatchObject({ status, updatedBy: 'approver' });
      expect(equipment.findOneBy).not.toHaveBeenCalled();
      await expect(
        service.syncApprovalStatus('B', 'request', status, 'approver'),
      ).rejects.toThrow('not found');
    },
  );
});

describe('Work request references and scope', () => {
  it('offers only readable, confirmed requests for work planning', async () => {
    const { service, request } = fixture();
    expect(await service.listForPlan(actor())).toEqual([]);
    await expect(service.findForPlan(actor(), 'request')).rejects.toThrow(
      'Only confirmed',
    );
    request.status = 'C';
    expect(await service.listForPlan(actor())).toHaveLength(1);
    expect(await service.findForPlan(actor(), 'request')).toBe(request);
    expect(await service.listForPlan(actor({ permissions: [] }))).toEqual([]);
    await expect(
      service.findForPlan(actor({ permissions: [] }), 'request'),
    ).rejects.toThrow('read permission');
  });
  it('does not leak another company or site through detail, changes or plan references', async () => {
    const { service, request } = fixture();
    request.status = 'C';
    for (const user of [
      actor({ companyId: 'B' }),
      actor({ accessScope: 'OWN_SITE', siteId: 'OTHER' }),
    ]) {
      expect(await service.findAll(user)).toEqual([]);
      await expect(service.findOne(user, 'request')).rejects.toThrow(
        'not found',
      );
      await expect(
        service.update(user, 'request', { title: '변경' }),
      ).rejects.toThrow('not found');
      await expect(service.findForPlan(user, 'request')).rejects.toThrow(
        'not found',
      );
    }
  });
  it('uses subordinate departments and fails closed when affiliation is missing', async () => {
    const { service, request, queries } = fixture();
    request.deptId = 'CHILD';
    expect(
      await service.findAll(actor({ accessScope: 'OWN_DEPARTMENT' })),
    ).toHaveLength(1);
    expect(queries[0].sql.join(' ')).toContain('WITH RECURSIVE');
    await expect(
      service.findAll(actor({ accessScope: 'OWN_SITE', siteId: null })),
    ).rejects.toThrow('scope or affiliation');
  });
  it('lists multiple readable plans using common refs without altering request status', async () => {
    const { service, request } = fixture();
    request.status = 'C';
    expect(
      (await service.relatedPlans(actor(), 'request')).map(
        (p) => p.workOrderId,
      ),
    ).toEqual(['plan1', 'plan2']);
    expect(
      await service.relatedPlans(
        actor({ permissions: ['work_request:read'] }),
        'request',
      ),
    ).toEqual([]);
    expect(request.status).toBe('C');
  });
  it('supplies company-specific equipment and priority code choices', async () => {
    const { service, codeItems } = fixture();
    expect((await service.getOptions(actor())).priorities).toEqual([
      { value: 'URGENT', label: '긴급' },
    ]);
    expect(codeItems.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'A', codeId: 'WORK_REQUEST_PRIORITY' },
      }),
    );
  });
  it('rejects forged ownership, affiliation and status fields in incoming requests', async () => {
    const dto = plainToInstance(CreateWorkRequestDto, {
      ...input,
      companyId: 'foreign',
      requesterId: 'other',
      status: 'C',
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(['companyId', 'requesterId', 'status']),
    );
  });
});
