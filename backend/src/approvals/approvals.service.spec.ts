import { PurchaseRequest } from '../purchase/purchase-request/entities/purchase-request.entity';
import { PurchaseOrder } from '../purchase/purchase-order/entities/purchase-order.entity';
import { PurchaseOrderService } from '../purchase/purchase-order/purchase-order.service';
import { PurchaseRequestService } from '../purchase/purchase-request/purchase-request.service';
import { WorkPermitService } from '../maintenance/work-permit/work-permit.service';
import { WorkRequest } from '../maintenance/work-request/entities/work-request.entity';
import { WorkRequestService } from '../maintenance/work-request/work-request.service';
import { PreventiveMaintenance } from '../maintenance/preventive-maintenance/entities/preventive-maintenance.entity';
import { WorkOrder } from '../maintenance/work-order/entities/work-order.entity';
import { WorkOrderService } from '../maintenance/work-order/work-order.service';
import { PreventiveMaintenanceService } from '../maintenance/preventive-maintenance/preventive-maintenance.service';
import { Logger } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator';
import { validate } from 'class-validator';
import { Repository, EntityManager } from 'typeorm';
import { ApprovalsService } from './approvals.service';
import { Approval } from './entities/approval.entity';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalStepInputDto } from './dto/approval-step-input.dto';
import { User } from '../identity/users/entities/user.entity';
import { Department } from '../organization/departments/entities/department.entity';
import { UserContext } from '../auth/types/user-context.type';

const actor = (userId: string) => ({ companyId: 'CR', userId }) as UserContext;
const contentJson = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [
        {
          type: 'text',
          text: '서식 있는 결재 본문',
          marks: [
            { type: 'bold' },
            { type: 'textStyle', attrs: { fontSize: '24px' } },
          ],
        },
      ],
    },
  ],
};

function fixture() {
  let approval: Approval;
  let steps: ApprovalStep[] = [];
  const headers = {
    create: (value: Approval) => value,
    save: async (value: Approval) => (approval = value),
    findOneBy: async () => approval ?? null,
    find: async () => [approval],
    manager: {
      update: jest.fn(async () => ({ affected: 1 })),
      findOneBy: jest.fn(async (entity: unknown, _where: unknown) =>
        entity === Approval
          ? approval
          : ({ attachmentId: 'source-files' } as {
              attachmentId: string | null;
            } | null),
      ),
    },
  };
  Object.assign(headers, {
    createQueryBuilder: () => {
      const params: Record<string, any> = {};
      let sql = '';
      const qb = {
        select: () => qb,
        where: (clause: string, values = {}) => {
          sql += clause;
          Object.assign(params, values);
          return qb;
        },
        andWhere: (clause: string, values = {}) => {
          sql += clause;
          Object.assign(params, values);
          return qb;
        },
        setParameters: (values: object) => {
          Object.assign(params, values);
          return qb;
        },
        setParameter: (key: string, value: unknown) => {
          params[key] = value;
          return qb;
        },
        orderBy: () => qb,
        addOrderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        getManyAndCount: async () => {
          const processing = steps.filter((s) =>
            ['APPROVER', 'AGREE'].includes(s.type),
          );
          const current = processing
            .filter((s) => !s.status?.trim())
            .sort((a, b) => a.stepNo - b.stepNo)[0];
          let visible =
            approval?.companyId === params.companyId &&
            approval.deleteYn === 'N';
          if (sql.includes('pending_step'))
            visible &&=
              approval.status === 'P' && current?.userId === params.userId;
          else if (sql.includes('processed_step'))
            visible &&=
              approval.status === 'P' &&
              processing.some(
                (s) => s.userId === params.userId && s.status === 'Y',
              );
          else if (sql.includes('closed_step'))
            visible &&=
              ['C', 'R', 'X'].includes(approval.status) &&
              (approval.submitterId === params.userId ||
                processing.some((s) => s.userId === params.userId));
          else if (sql.includes('reference_step'))
            visible &&=
              approval.status === 'C' &&
              steps.some(
                (s) => s.type === 'REFERENCE' && s.userId === params.userId,
              );
          else visible &&= approval.submitterId === params.userId;
          return [visible ? [approval] : [], visible ? 1 : 0];
        },
      };
      return qb;
    },
  });
  const lines = {
    create: (value: ApprovalStep) => value,
    save: async (value: ApprovalStep | ApprovalStep[]) => {
      if (Array.isArray(value)) steps = value;
      return value;
    },
    delete: async () => {
      steps = [];
    },
    find: async (query: { where: { userId?: string } }) =>
      query.where.userId
        ? steps.filter((s) => s.userId === query.where.userId)
        : steps,
  };
  const pm = {
    assertCanSubmit: jest.fn(async () => undefined),
    syncApprovalStatus: jest.fn(async () => undefined),
  };
  const workOrder = {
    syncApprovalStatus: jest.fn(async () => undefined),
    assertCanSubmit: jest.fn(async () => undefined),
  };
  const workRequest = {
    assertCanSubmit: jest.fn(async () => undefined),
    syncApprovalStatus: jest.fn(async () => undefined),
  };
  const workPermit = {
    approvalDraft: jest.fn(async () => ({
      refModule: 'PERMIT',
      refId: 'permit',
      title: '서버 원본',
      contentJson,
      attachmentId: null,
      steps: [
        { type: 'APPROVER', userId: 'issuer' },
        { type: 'APPROVER', userId: 'manager' },
      ],
    })),
    relatedAttachmentIds: jest.fn(async () => []),
    syncApprovalStatus: jest.fn(async () => undefined),
  };
  const purchaseRequests = {
    assertCanSubmit: jest.fn(async () => undefined),
    syncApprovalStatus: jest.fn(async () => undefined),
  };
  const purchaseOrders = {
    assertCanSubmit: jest.fn(async () => undefined),
    syncApprovalStatus: jest.fn(async () => undefined),
  };
  for (const source of [
    pm,
    workOrder,
    workRequest,
    workPermit,
    purchaseRequests,
    purchaseOrders,
  ])
    Object.assign(source, { withManager: () => source });
  const participants = new Set([
    'author',
    'manager',
    'reviewer',
    'reader',
    'issuer',
  ]);
  const users = {
    findBy: async (where: { userId: { value: string[] }; companyId: string }) =>
      where.userId.value
        .filter((id) => participants.has(id))
        .map((id) => ({
          companyId: where.companyId,
          userId: id,
          name: id,
          deptId: 'D1',
          deleteYn: 'N',
        })),
  };
  const departments = { findBy: async () => [] };
  Object.assign(headers.manager, {
    connection: {
      createQueryRunner: () => ({
        connect: async () => undefined,
        query: async () => [],
        manager: headers.manager,
        release: async () => undefined,
      }),
    },
    query: jest.fn(async () => []),
    getRepository: (entity: unknown) =>
      entity === Approval
        ? headers
        : entity === ApprovalStep
          ? lines
          : entity === User
            ? users
            : departments,
    transaction: async (work: (manager: EntityManager) => Promise<unknown>) => {
      const previous = structuredClone({ approval, steps });
      try {
        return await work(headers.manager as unknown as EntityManager);
      } catch (error) {
        approval = previous.approval;
        steps = previous.steps;
        throw error;
      }
    },
  });
  const service = new ApprovalsService(
    headers as unknown as Repository<Approval>,
    lines as unknown as Repository<ApprovalStep>,
    users as unknown as Repository<User>,
    departments as unknown as Repository<Department>,
    pm as unknown as PreventiveMaintenanceService,
    workOrder as unknown as WorkOrderService,
    workRequest as unknown as WorkRequestService,
    workPermit as unknown as WorkPermitService,
    purchaseRequests as unknown as PurchaseRequestService,
    purchaseOrders as unknown as PurchaseOrderService,
  );
  const create = (
    line: { type: 'APPROVER' | 'AGREE' | 'REFERENCE'; userId: string }[],
    submit = false,
  ) =>
    service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      documentNo: ' AP-202611-001 ',
      title: '결재 테스트',
      contentJson,
      steps: line,
      submit,
    });
  return {
    service,
    create,
    headers,
    pm,
    workOrder,
    workRequest,
    workPermit,
    purchaseRequests,
    purchaseOrders,
  };
}

describe('ApprovalsService agreement flow', () => {
  it('keeps permit content while accepting independently chosen approvers and agreements', async () => {
    const { service, workPermit } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'forged',
      contentJson: { type: 'doc', content: [] },
      refModule: 'PERMIT',
      refId: 'permit',
      steps: [
        { type: 'AGREE', userId: 'reviewer' },
        { type: 'APPROVER', userId: 'manager' },
      ],
      submit: true,
    });
    expect(approval.title).toBe('서버 원본');
    expect(
      approval.steps
        .filter((s) => ['APPROVER', 'AGREE'].includes(s.type))
        .map((s) => s.userId),
    ).toEqual(['reviewer', 'manager']);
    await service.approve(actor('reviewer'), approval.approvalId, {});
    expect(
      (await service.findOne(actor('author'), approval.approvalId)).status,
    ).toBe('P');
    await service.approve(actor('manager'), approval.approvalId, {});
    expect(workPermit.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'permit',
      'C',
      'manager',
      approval.approvalId,
    );
  });

  it('checks and updates only the linked work request on submission and completion', async () => {
    const { service, workRequest } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: '의뢰 승인',
      contentJson,
      refModule: 'WRKREQ',
      refId: 'request',
      steps: [{ type: 'APPROVER', userId: 'manager' }],
      submit: true,
    });
    expect(workRequest.assertCanSubmit).toHaveBeenCalledWith(
      actor('author'),
      'request',
    );
    expect(workRequest.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'request',
      'P',
      'author',
    );
    await service.approve(actor('manager'), approval.approvalId, {});
    expect(workRequest.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'request',
      'C',
      'manager',
    );
  });

  it.each([
    ['PMAINT', PreventiveMaintenance, 'pmId'],
    ['WRKORD', WorkOrder, 'workOrderId'],
    ['WRKREQ', WorkRequest, 'workRequestId'],
    ['PURREQ', PurchaseRequest, 'requestId'],
    ['PURORD', PurchaseOrder, 'orderId'],
  ] as const)(
    'links %s attachments from the authenticated company source, ignoring client IDs',
    async (refModule, entity, idField) => {
      const { service, headers } = fixture();
      const draft = await service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: '원본 첨부',
        contentJson,
        refModule,
        refId: 'source-id',
        attachmentId: 'client-files',
        steps: [{ type: 'APPROVER', userId: 'manager' }],
      });
      expect(draft.attachmentId).toBe('source-files');
      expect(headers.manager.findOneBy).toHaveBeenCalledWith(entity, {
        companyId: 'CR',
        [idField]: 'source-id',
        deleteYn: 'N',
      });
      headers.manager.findOneBy.mockResolvedValue({
        attachmentId: 'latest-files',
      });
      expect(
        (
          await service.update(actor('author'), draft.approvalId, {
            attachmentId: 'forged-files',
          })
        ).attachmentId,
      ).toBe('latest-files');
      headers.manager.findOneBy.mockResolvedValue({
        attachmentId: 'submit-files',
      });
      expect(
        (await service.submit(actor('author'), draft.approvalId)).attachmentId,
      ).toBe('submit-files');
    },
  );
  it('keeps a linked approval empty when the source has no attachment group', async () => {
    const { service, headers } = fixture();
    headers.manager.findOneBy.mockResolvedValue({ attachmentId: null });
    expect(
      (
        await service.create(actor('author'), {
          approvalId: 'APPROV-202611-00001',
          title: '첨부 없음',
          contentJson,
          refModule: 'WRKORD',
          refId: 'source',
          attachmentId: 'client-files',
          steps: [],
        })
      ).attachmentId,
    ).toBeNull();
  });
  it('rejects a missing or other-company source and incomplete references', async () => {
    const { service, headers } = fixture();
    headers.manager.findOneBy.mockResolvedValue(null);
    await expect(
      service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: '원본 없음',
        contentJson,
        refModule: 'WRKORD',
        refId: 'foreign',
        steps: [],
      }),
    ).rejects.toThrow('원문 문서를 찾을 수 없습니다.');
    await expect(
      service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: '불완전 참조',
        contentJson,
        refModule: 'WRKORD',
        steps: [],
      }),
    ).rejects.toThrow('원문 모듈과 문서번호를 함께 지정해 주세요.');
  });
  it('preserves a standalone approval’s own attachments', async () => {
    const { service, headers } = fixture();
    const draft = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: '일반 결재',
      contentJson,
      attachmentId: 'own-files',
      steps: [],
    });
    expect(draft.attachmentId).toBe('own-files');
    expect(headers.manager.findOneBy).not.toHaveBeenCalled();
    expect(
      (
        await service.update(actor('author'), draft.approvalId, {
          attachmentId: 'other-own-files',
        })
      ).attachmentId,
    ).toBe('other-own-files');
  });

  it('requires JWT without controller RBAC declarations', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ApprovalsController)).toEqual([
      JwtAuthGuard,
    ]);
    for (const method of Object.getOwnPropertyNames(
      ApprovalsController.prototype,
    )) {
      if (method === 'constructor') continue;
      expect(
        Reflect.getMetadata(
          REQUIRED_PERMISSIONS_KEY,
          Object.getOwnPropertyDescriptor(
            ApprovalsController.prototype,
            method,
          )!.value,
        ),
      ).toBeUndefined();
    }
  });

  it('allows saving and submitting without a document number', async () => {
    const { service } = fixture();
    const saved = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'No management number',
      contentJson,
      steps: [{ type: 'AGREE', userId: 'reviewer' }],
      submit: true,
    });
    expect(saved.documentNo).toBe('');
    expect(saved.status).toBe('P');
    const rejected = await service.reject(
      actor('reviewer'),
      saved.approvalId,
      {},
    );
    expect(rejected.status).toBe('R');
    expect(rejected.steps[1].comment).toBeNull();
  });

  it('keeps approval in draft when PM submission validation fails', async () => {
    const { service, pm } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'Linked PM',
      contentJson,
      refModule: 'PMAINT',
      refId: 'pm-1',
      steps: [{ type: 'APPROVER', userId: 'manager' }],
    });
    pm.assertCanSubmit.mockRejectedValueOnce(
      new Error('점검 정보 누락') as never,
    );
    await expect(
      service.submit(actor('author'), approval.approvalId),
    ).rejects.toThrow('점검 정보 누락');
    expect(
      (await service.findOne(actor('author'), approval.approvalId)).status,
    ).toBe('D');
    expect(pm.syncApprovalStatus).not.toHaveBeenCalled();
  });

  it('delegates linked PM status updates with company and acting-user context', async () => {
    const { service, pm, headers } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'Linked PM',
      contentJson,
      refModule: 'PMAINT',
      refId: 'pm-1',
      steps: [{ type: 'APPROVER', userId: 'manager' }],
      submit: true,
    });
    expect(pm.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'pm-1',
      'P',
      'author',
    );
    await service.approve(actor('manager'), approval.approvalId, {});
    expect(pm.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'pm-1',
      'C',
      'manager',
    );
    expect(headers.manager.update).not.toHaveBeenCalled();
  });

  it('does not submit or sync when the linked Work Order is not an accessible owner draft', async () => {
    const { service, workOrder } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'Work Order',
      contentJson,
      refModule: 'WRKORD',
      refId: 'wo-1',
      steps: [{ type: 'APPROVER', userId: 'manager' }],
    });
    workOrder.assertCanSubmit.mockRejectedValueOnce(
      new Error('Only the owner') as never,
    );
    await expect(
      service.submit(actor('author'), approval.approvalId),
    ).rejects.toThrow('Only the owner');
    expect(
      (await service.findOne(actor('author'), approval.approvalId)).status,
    ).toBe('D');
    expect(workOrder.syncApprovalStatus).not.toHaveBeenCalled();
  });

  it('syncs the linked Work Order alone and retains an approved result on source failure', async () => {
    const { service, workOrder, headers } = fixture();
    const approval = await service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: 'Work Order',
      contentJson,
      refModule: 'WRKORD',
      refId: 'wo-1',
      steps: [{ type: 'APPROVER', userId: 'manager' }],
      submit: true,
    });
    expect(workOrder.syncApprovalStatus).toHaveBeenLastCalledWith(
      'CR',
      'wo-1',
      'P',
      'author',
    );
    workOrder.syncApprovalStatus.mockRejectedValueOnce(
      new Error('Source failure') as never,
    );
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        service.approve(actor('manager'), approval.approvalId, {}),
      ).resolves.toMatchObject({
        status: 'C',
        sourceSyncWarning: expect.stringContaining('원문 상태 반영에 실패'),
      });
      expect(
        (await service.findOne(actor('author'), approval.approvalId)).status,
      ).toBe('C');
      expect(workOrder.syncApprovalStatus).toHaveBeenLastCalledWith(
        'CR',
        'wo-1',
        'C',
        'manager',
      );
      expect(headers.manager.update).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          refModule: 'WRKORD',
          refId: 'wo-1',
          stage: 'syncSourceStatus',
        }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('keeps the saved approval and logs identifiers if source update fails', async () => {
    const { service, pm } = fixture();
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      const approval = await service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: 'Linked document',
        contentJson,
        refModule: 'PMAINT',
        refId: 'e6c2f691-e88a-4f82-9868-2db8f2d52b18',
        steps: [{ type: 'APPROVER', userId: 'manager' }],
        submit: true,
      });
      pm.syncApprovalStatus.mockRejectedValueOnce(
        new Error('Source unavailable') as never,
      );
      await expect(
        service.approve(actor('manager'), approval.approvalId, {}),
      ).resolves.toMatchObject({
        status: 'C',
        sourceSyncWarning: expect.stringContaining('원문 상태 반영에 실패'),
      });
      const retained = (await service.findBox(actor('author'), 'submit'))
        .items[0];
      expect(retained.status).toBe('C');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'CR',
          approvalId: retained.approvalId,
          status: 'C',
          stage: 'syncSourceStatus',
        }),
      );
    } finally {
      log.mockRestore();
    }
  });

  it('saves and updates a trimmed document number without changing the UUID', async () => {
    const { service, create } = fixture();
    const draft = await create([{ type: 'APPROVER', userId: 'manager' }]);
    expect(draft.documentNo).toBe('AP-202611-001');
    const updated = await service.update(actor('author'), draft.approvalId, {
      documentNo: ' AP-202611-002 ',
    });
    expect(updated.documentNo).toBe('AP-202611-002');
    expect(updated.approvalId).toBe(draft.approvalId);
    const unchanged = await service.update(actor('author'), draft.approvalId, {
      title: '제목 수정',
    });
    expect(unchanged.documentNo).toBe('AP-202611-002');
    expect(
      (await service.findBox(actor('author'), 'submit')).items[0].documentNo,
    ).toBe('AP-202611-002');
    expect(
      (
        await service.update(actor('author'), draft.approvalId, {
          documentNo: '  ',
        })
      ).documentNo,
    ).toBe('');
  });

  it('accepts AGREE through DTO validation', async () => {
    const dto = Object.assign(new ApprovalStepInputDto(), {
      type: 'AGREE',
      userId: 'reviewer',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('preserves JSON formatting and processes mixed steps strictly in order', async () => {
    const { service, create } = fixture();
    const draft = await create([
      { type: 'AGREE', userId: 'reviewer' },
      { type: 'APPROVER', userId: 'manager' },
      { type: 'REFERENCE', userId: 'reader' },
    ]);
    expect(draft.contentJson).toEqual(contentJson);
    expect(draft.steps.map((s) => [s.type, s.stepNo])).toEqual([
      ['SUBMITTER', 0],
      ['AGREE', 1],
      ['APPROVER', 2],
      ['REFERENCE', 3],
    ]);
    await service.submit(actor('author'), draft.approvalId);
    await expect(
      service.approve(actor('manager'), draft.approvalId, {}),
    ).rejects.toThrow('현재 결재 차례가 아닙니다.');
    expect(
      (await service.findBox(actor('reviewer'), 'pending')).items,
    ).toHaveLength(1);
    const agreed = await service.approve(actor('reviewer'), draft.approvalId, {
      comment: '동의',
    });
    expect(agreed.status).toBe('P');
    expect(agreed.steps[1].comment).toBe('동의');
    expect(
      (await service.findBox(actor('reviewer'), 'processed')).items,
    ).toHaveLength(1);
    expect(
      (await service.findBox(actor('manager'), 'pending')).items,
    ).toHaveLength(1);
    const completed = await service.approve(
      actor('manager'),
      draft.approvalId,
      {},
    );
    expect(completed.status).toBe('C');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.contentJson).toEqual(contentJson);
    expect(
      (await service.findBox(actor('reviewer'), 'closed')).items,
    ).toHaveLength(1);
  });

  it('completes an agreement-only line and never waits for references', async () => {
    const { service, create } = fixture();
    const approval = await create(
      [
        { type: 'AGREE', userId: 'reviewer' },
        { type: 'REFERENCE', userId: 'reader' },
      ],
      true,
    );
    expect(
      (await service.approve(actor('reviewer'), approval.approvalId, {}))
        .status,
    ).toBe('C');
    expect(
      (await service.findBox(actor('reader'), 'pending')).items,
    ).toHaveLength(0);
  });

  it('rejects the document when the current agreement step disagrees', async () => {
    const { service, create } = fixture();
    const approval = await create(
      [{ type: 'AGREE', userId: 'reviewer' }],
      true,
    );
    const rejected = await service.reject(
      actor('reviewer'),
      approval.approvalId,
      { comment: '부동의' },
    );
    expect(rejected.status).toBe('R');
    expect(rejected.steps[1].status).toBe('N');
    expect(rejected.steps[1].comment).toBe('부동의');
    expect(
      (await service.findBox(actor('reviewer'), 'closed')).items,
    ).toHaveLength(1);
  });

  it.each(['approve', 'reject', 'cancel'] as const)(
    'checks reference access after %s: only approval completion is visible',
    async (action) => {
      const { service, create } = fixture();
      const approval = await create([
        { type: 'APPROVER', userId: 'manager' },
        { type: 'REFERENCE', userId: 'reader' },
      ]);
      const read = () => service.findOne(actor('reader'), approval.approvalId);
      await expect(read()).rejects.toThrow('이 문서를 조회할 권한이 없습니다.');
      expect(
        (await service.findBox(actor('reader'), 'reference')).items,
      ).toHaveLength(0);
      expect(
        (await service.findOne(actor('author'), approval.approvalId)).status,
      ).toBe('D');
      expect(
        (await service.findOne(actor('manager'), approval.approvalId)).status,
      ).toBe('D');
      await service.submit(actor('author'), approval.approvalId);
      await expect(read()).rejects.toThrow('이 문서를 조회할 권한이 없습니다.');
      expect(
        (await service.findBox(actor('reader'), 'reference')).items,
      ).toHaveLength(0);
      expect(
        (await service.findOne(actor('manager'), approval.approvalId)).status,
      ).toBe('P');
      if (action === 'cancel') {
        await service.cancel(actor('author'), approval.approvalId);
      } else {
        await service[action](actor('manager'), approval.approvalId, {});
      }
      if (action === 'approve') {
        expect((await read()).status).toBe('C');
        expect(
          (await service.findBox(actor('reader'), 'reference')).items,
        ).toHaveLength(1);
      } else {
        await expect(read()).rejects.toThrow(
          '이 문서를 조회할 권한이 없습니다.',
        );
        expect(
          (await service.findBox(actor('reader'), 'reference')).items,
        ).toHaveLength(0);
      }
    },
  );
});

describe('Purchase approval linking', () => {
  it.each(['PURREQ', 'PURORD'])(
    'validates and syncs %s separately from approval storage',
    async (refModule) => {
      const { service, purchaseRequests, purchaseOrders } = fixture();
      const purchases =
        refModule === 'PURREQ' ? purchaseRequests : purchaseOrders;
      const unrelated =
        refModule === 'PURREQ' ? purchaseOrders : purchaseRequests;
      const row = await service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: '구매 결재',
        contentJson,
        refModule,
        refId: 'source',
        steps: [{ type: 'APPROVER', userId: 'manager' }],
        submit: true,
      });
      expect(purchases.assertCanSubmit).toHaveBeenCalledWith(
        actor('author'),
        'source',
      );
      expect(purchases.syncApprovalStatus).toHaveBeenLastCalledWith(
        'CR',
        'source',
        'P',
        'author',
      );
      expect(unrelated.assertCanSubmit).not.toHaveBeenCalled();
      expect(unrelated.syncApprovalStatus).not.toHaveBeenCalled();
      expect(row.attachmentId).toBe('source-files');
      await service.approve(actor('manager'), row.approvalId, {});
      expect(purchases.syncApprovalStatus).toHaveBeenLastCalledWith(
        'CR',
        'source',
        'C',
        'manager',
      );
    },
  );
});

it.each(['unknown', 'BORD', 'toString'])(
  'rejects an unsupported approval source before reading it: %s',
  async (refModule) => {
    const { service, headers } = fixture();
    await expect(
      service.create(actor('author'), {
        approvalId: 'APPROV-202611-00001',
        title: '잘못된 연결',
        contentJson,
        refModule,
        refId: 'source',
        steps: [],
      }),
    ).rejects.toThrow('지원하지 않는 원문 모듈입니다.');
    expect(headers.manager.findOneBy).not.toHaveBeenCalled();
  },
);

it.each([
  'plain text',
  { text: 'plain text' },
  [],
  { type: 'doc', content: 'invalid' },
])('rejects non-document approval content: %j', async (invalid) => {
  const { service } = fixture();
  await expect(
    service.create(actor('author'), {
      approvalId: 'APPROV-202611-00001',
      title: '본문 검사',
      contentJson: invalid,
      steps: [],
    }),
  ).rejects.toThrow('본문 문서 형식을 확인해 주세요.');
});

it('allows editing a permit approval line independently and retains it on unrelated saves', async () => {
  const { service } = fixture();
  const saved = await service.create(actor('author'), {
    approvalId: 'APPROV-202611-00001',
    title: '원문 제목',
    contentJson,
    refModule: 'PERMIT',
    refId: 'permit',
    steps: [{ type: 'REFERENCE', userId: 'reader' }],
  });
  expect(saved.steps.map((step) => step.userId)).toEqual(['author', 'reader']);
  const updated = await service.update(actor('author'), saved.approvalId, {
    steps: [
      { type: 'APPROVER', userId: 'manager' },
      { type: 'REFERENCE', userId: 'reviewer' },
    ],
  });
  expect(updated.steps.map((step) => step.userId)).toEqual([
    'author',
    'manager',
    'reviewer',
  ]);
  expect(
    (
      await service.update(actor('author'), saved.approvalId, {
        documentNo: '수동번호',
      })
    ).steps.at(-1)?.userId,
  ).toBe('reviewer');
});
