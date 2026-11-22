import { Logger } from '@nestjs/common';
import { WorkRequest } from '../maintenance/work-request/entities/work-request.entity';
import { Equipment } from '../maintenance/equipment/entities/equipment.entity';
import { WorkRequestService } from '../maintenance/work-request/work-request.service';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../test/support/pglite';
import { ApprovalsService } from './approvals.service';
import { Approval } from './entities/approval.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { User } from '../identity/users/entities/user.entity';
import { Department } from '../organization/departments/entities/department.entity';
import type { UserContext } from '../auth/types/user-context.type';

jest.setTimeout(90000);
let db: DataSource, close: () => Promise<void>, service: ApprovalsService;
const actor = (userId: string, companyId = 'A') =>
  ({ companyId, userId, accessScope: 'COMPANY_ALL' }) as UserContext;
const document = (
  steps: { userId: string; type: 'APPROVER' | 'AGREE' | 'REFERENCE' }[],
  id = 'APPROV-202611-00001',
) => ({
  approvalId: id,
  title: '결재 문서',
  contentJson: { type: 'doc', content: [] },
  steps,
});
beforeAll(async () => {
  const fixture = await postgresTestDatabase([
    Approval,
    ApprovalStep,
    User,
    Department,
    WorkRequest,
    Equipment,
  ]);
  db = fixture.dataSource;
  close = fixture.close;
  service = new ApprovalsService(
    db.getRepository(Approval),
    db.getRepository(ApprovalStep),
    db.getRepository(User),
    db.getRepository(Department),
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  for (const entity of [ApprovalStep, Approval, User, WorkRequest])
    await db.getRepository(entity).clear();
  await db.getRepository(User).save(
    ['owner', 'A1', 'B1', 'C1'].map((userId) => ({
      companyId: 'A',
      userId,
      name: userId,
      passwordHash: 'unused',
      roleId: 'USER',
      deptId: 'D1',
      accessScope: 'OWN_DEPARTMENT' as const,
      deleteYn: 'N',
      createdBy: 'test',
    })),
  );
  await db.getRepository(User).save({
    companyId: 'B',
    userId: 'foreign',
    name: '타사',
    passwordHash: 'unused',
    roleId: 'USER',
    deptId: 'D1',
    accessScope: 'OWN_DEPARTMENT',
    deleteYn: 'N',
    createdBy: 'test',
  });
});

it('partitions interleaved references last while preserving the processing order and numeric DB sequence', async () => {
  const saved = await service.create(
    actor('owner'),
    document([
      { userId: 'A1', type: 'APPROVER' },
      { userId: 'C1', type: 'REFERENCE' },
      { userId: 'B1', type: 'AGREE' },
    ]),
  );
  expect(saved.steps.map(({ userId, stepNo }) => [userId, stepNo])).toEqual([
    ['owner', 0],
    ['A1', 1],
    ['B1', 2],
    ['C1', 3],
  ]);
  await service.submit(actor('owner'), saved.approvalId);
  await expect(
    service.approve(actor('B1'), saved.approvalId, {}),
  ).rejects.toThrow();
  await service.approve(actor('A1'), saved.approvalId, {});
  const complete = await service.approve(actor('B1'), saved.approvalId, {});
  expect(complete.status).toBe('C');
  expect(complete.completedAt).toBeInstanceOf(Date);
  expect((await service.findOne(actor('C1'), saved.approvalId)).status).toBe(
    'C',
  );
});

it.each([
  [
    { userId: 'A1', type: 'APPROVER' as const },
    { userId: 'A1', type: 'REFERENCE' as const },
  ],
  [{ userId: 'owner', type: 'APPROVER' as const }],
  [{ userId: 'foreign', type: 'APPROVER' as const }],
  [{ userId: 'missing', type: 'REFERENCE' as const }],
])(
  'rolls back the document and all steps on an invalid participant list: %j',
  async (...steps) => {
    await expect(
      service.create(actor('owner'), document(steps)),
    ).rejects.toThrow();
    expect(await db.getRepository(Approval).count()).toBe(0);
    expect(await db.getRepository(ApprovalStep).count()).toBe(0);
  },
);

it('rolls back title changes when replacement steps fail and rechecks active users at submission', async () => {
  const saved = await service.create(
    actor('owner'),
    document([{ userId: 'A1', type: 'APPROVER' }]),
  );
  await expect(
    service.update(actor('owner'), saved.approvalId, {
      title: '실패할 수정',
      steps: [{ userId: 'foreign', type: 'APPROVER' }],
    }),
  ).rejects.toThrow();
  const retained = await service.findOne(actor('owner'), saved.approvalId);
  expect(retained.title).toBe('결재 문서');
  expect(retained.steps.map((step) => step.userId)).toEqual(['owner', 'A1']);
  await db
    .getRepository(User)
    .update({ companyId: 'A', userId: 'A1' }, { deleteYn: 'Y' });
  await expect(
    service.submit(actor('owner'), saved.approvalId),
  ).rejects.toThrow();
  expect((await service.findOne(actor('owner'), saved.approvalId)).status).toBe(
    'D',
  );
});

it('does not submit reference-only drafts and does not process the same approval step twice', async () => {
  const reference = await service.create(
    actor('owner'),
    document([{ userId: 'C1', type: 'REFERENCE' }]),
  );
  await expect(
    service.submit(actor('owner'), reference.approvalId),
  ).rejects.toThrow();
  const saved = await service.create(actor('owner'), {
    ...document(
      [
        { userId: 'A1', type: 'APPROVER' },
        { userId: 'B1', type: 'AGREE' },
      ],
      'APPROV-202611-00002',
    ),
    submit: true,
  });
  const attempts = await Promise.allSettled([
    service.approve(actor('A1'), saved.approvalId, {}),
    service.approve(actor('A1'), saved.approvalId, {}),
  ]);
  expect(
    attempts.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  const current = await service.findOne(actor('owner'), saved.approvalId);
  expect(current.status).toBe('P');
  expect(current.steps.find((step) => step.userId === 'B1')?.status).toBeNull();
  await service.reject(actor('B1'), saved.approvalId, { comment: '부동의' });
  expect((await service.findOne(actor('owner'), saved.approvalId)).status).toBe(
    'R',
  );
});

function linkedService(source: WorkRequestService) {
  return new ApprovalsService(
    db.getRepository(Approval),
    db.getRepository(ApprovalStep),
    db.getRepository(User),
    db.getRepository(Department),
    {} as never,
    {} as never,
    source,
    {} as never,
    {} as never,
    {} as never,
  );
}
async function linkedDraft() {
  await db.getRepository(WorkRequest).save({
    companyId: 'A',
    workRequestId: 'WR1',
    documentNo: '',
    title: '원문',
    equipmentId: 'EQ1',
    occurredDate: '20261114',
    content: '이상',
    requesterId: 'owner',
    createdBy: 'owner',
    status: 'D',
  });
  return {
    ...document([{ userId: 'A1', type: 'APPROVER' }]),
    refModule: 'WRKREQ',
    refId: 'WR1',
  };
}

it('validates and synchronizes a real linked source using the same single database connection', async () => {
  const source = new WorkRequestService(
    db.getRepository(WorkRequest),
    db.getRepository(Equipment),
  );
  const linked = linkedService(source);
  const saved = await linked.create(actor('owner'), {
    ...(await linkedDraft()),
    submit: true,
  });
  expect(
    (
      await db
        .getRepository(WorkRequest)
        .findOneByOrFail({ companyId: 'A', workRequestId: 'WR1' })
    ).status,
  ).toBe('P');
  await linked.approve(actor('A1'), saved.approvalId, {});
  expect(
    (
      await db
        .getRepository(WorkRequest)
        .findOneByOrFail({ companyId: 'A', workRequestId: 'WR1' })
    ).status,
  ).toBe('C');
});

it('releases the source lock after a downstream failure and retains already committed approval and source writes', async () => {
  const source = new WorkRequestService(
    db.getRepository(WorkRequest),
    db.getRepository(Equipment),
  );
  const factory = source.withManager.bind(source);
  jest.spyOn(source, 'withManager').mockImplementation((manager) => {
    const scoped = factory(manager);
    const synchronize = scoped.syncApprovalStatus.bind(scoped);
    scoped.syncApprovalStatus = async (...args) => {
      await synchronize(...args);
      throw new Error('후속 처리 실패');
    };
    return scoped;
  });
  const linked = linkedService(source);
  const log = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  try {
    await expect(
      linked.create(actor('owner'), { ...(await linkedDraft()), submit: true }),
    ).resolves.toMatchObject({
      status: 'P',
      sourceSyncWarning: expect.stringContaining('원문 상태 반영에 실패'),
    });
    expect(
      (await linked.findOne(actor('owner'), 'APPROV-202611-00001')).status,
    ).toBe('P');
    expect(
      (
        await db
          .getRepository(WorkRequest)
          .findOneByOrFail({ companyId: 'A', workRequestId: 'WR1' })
      ).status,
    ).toBe('P');
    expect(await db.query('SELECT 1 AS alive')).toEqual([{ alive: 1 }]);
  } finally {
    log.mockRestore();
  }
});

// 실제 SQL로 회사 격리·문서함·검색·건수·경량 응답을 함께 검증한다.
it('paginates and searches each box without leaking other companies or reference drafts', async () => {
  const first = await service.create(
    actor('owner'),
    document(
      [
        { userId: 'A1', type: 'APPROVER' },
        { userId: 'B1', type: 'AGREE' },
        { userId: 'C1', type: 'REFERENCE' },
      ],
      'APPROV-202611-00001',
    ),
  );
  const second = await service.create(actor('owner'), {
    ...document([{ userId: 'A1', type: 'APPROVER' }], 'APPROV-202611-00002'),
    documentNo: '관리%_번호',
  });
  const sameTime = new Date('2026-11-01T00:00:00Z');
  await db
    .getRepository(Approval)
    .update({ companyId: 'A' }, { createdAt: sameTime });
  await db
    .getRepository(Approval)
    .save({ ...first, companyId: 'B', approvalId: 'FOREIGN' });
  const page1 = await service.findBox(actor('owner'), 'submit', { limit: 1 });
  expect(page1).toMatchObject({ total: 2, page: 1, limit: 1 });
  expect(page1.items[0].approvalId).toBe(second.approvalId);
  expect(Object.keys(page1.items[0]).sort()).toEqual(
    [
      'approvalId',
      'documentNo',
      'title',
      'submitterId',
      'status',
      'createdAt',
    ].sort(),
  );
  expect(
    (await service.findBox(actor('owner'), 'submit', { limit: 1, page: 2 }))
      .items[0].approvalId,
  ).toBe(first.approvalId);
  expect(
    (await service.findBox(actor('owner'), 'submit', { search: '%_' })).total,
  ).toBe(1);
  expect(
    (await service.findBox(actor('owner'), 'submit', { search: '不存在' }))
      .total,
  ).toBe(0);
  expect((await service.findBox(actor('owner', 'B'), 'submit')).total).toBe(1);
  expect((await service.findBox(actor('C1'), 'reference')).total).toBe(0);
  await service.submit(actor('owner'), first.approvalId);
  expect(
    (await service.findBox(actor('A1'), 'pending')).items.map(
      (x) => x.approvalId,
    ),
  ).toEqual([first.approvalId]);
  expect((await service.findBox(actor('B1'), 'pending')).total).toBe(0);
  await service.approve(actor('A1'), first.approvalId, {});
  expect((await service.findBox(actor('A1'), 'processed')).total).toBe(1);
  expect((await service.findBox(actor('B1'), 'pending')).total).toBe(1);
  expect(
    (await service.findBox(actor('owner'), 'submit', { status: 'D' })).total,
  ).toBe(1);
  await service.approve(actor('B1'), first.approvalId, {});
  expect((await service.findBox(actor('A1'), 'closed')).total).toBe(1);
  expect((await service.findBox(actor('A1'), 'processed')).total).toBe(0);
  expect((await service.findBox(actor('C1'), 'reference')).total).toBe(1);
  expect((await service.findBox(actor('C1'), 'closed')).total).toBe(0);
  expect(
    (await service.findBox(actor('owner'), 'submit', { limit: 1000 })).limit,
  ).toBe(100);
  await expect(
    service.findBox(actor('owner'), 'submit', { page: 0 }),
  ).rejects.toThrow();
});
