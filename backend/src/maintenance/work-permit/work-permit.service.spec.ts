import { Repository } from 'typeorm';
import { WorkPermitService } from './work-permit.service';
import { WorkPermit } from './entities/work-permit.entity';
import { WorkPermitRequestService } from '../work-permit-request/work-permit-request.service';
import { WorkPermitRequest } from '../work-permit-request/entities/work-permit-request.entity';
import { AttachmentItem } from '../../attachments/entities/attachment-item.entity';
import { Approval } from '../../approvals/entities/approval.entity';
import { ApprovalStep } from '../../approvals/entities/approval-step.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { PERMIT_TEMPLATES } from './permit-template';
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { validatePermitData } from './permit-validation';
const user = {
  companyId: 'A',
  userId: 'owner',
  accessScope: 'COMPANY_ALL',
} as UserContext;
const data = {
  title: '밸브 정비',
  applicationDate: '20261106',
  applicantType: 'EXTERNAL',
  applicantName: '작업자',
  organization: '시공사',
  workType: 'OUTSOURCED',
  location: '현장',
  startTime: '20261106:09',
  endTime: '20261106:18',
  summary: '정비',
};
function fixture() {
  const source = { status: 'C', attachmentId: 'request-files' };
  const dto = {
    workPermitId: 'permit',
    documentNo: '',
    data,
    refModule: null,
    refId: null,
    permitTypes: ['GENERAL'],
    sections: [{ ...PERMIT_TEMPLATES[0] }],
    issuerId: 'issuer',
    approverId: 'approver',
    attachmentId: 'files',
    documentFiles: [
      { requirementId: 'WORK_PLAN', attachmentId: 'files', itemNo: 1 },
      { requirementId: 'RISK_ASSESSMENT', attachmentId: 'files', itemNo: 2 },
    ],
  } satisfies CreateWorkPermitDto;
  let row: WorkPermit | null = null;
  const file = {
    findOneBy: jest.fn(async () => ({ itemNo: 1 }) as AttachmentItem | null),
  };
  const approval = {
    findOneBy: jest.fn(
      async () => ({ approvalId: 'approval' }) as Approval | null,
    ),
  };
  const steps = {
    find: jest.fn(
      async () =>
        [
          { userId: 'issuer', status: 'Y' },
          { userId: 'approver', status: 'Y' },
        ] as ApprovalStep[],
    ),
  };
  const repository = {
    create: (v: WorkPermit) => v,
    save: jest.fn(async (v: WorkPermit) => (row = v)),
    findOneBy: jest.fn(async (q: { companyId: string }) =>
      q.companyId === 'A' ? row : null,
    ),
    createQueryBuilder: () => {
      let companyId = '';
      const q = {
        where: (_s: string, p: { companyId: string }) => {
          companyId = p.companyId;
          return q;
        },
        andWhere: () => q,
        getOne: async () => (companyId === 'A' ? row : null),
      };
      return q;
    },
    manager: {
      getRepository: (entity: unknown) =>
        entity === AttachmentItem
          ? file
          : entity === Approval
            ? approval
            : entity === ApprovalStep
              ? steps
              : entity === WorkPermitRequest
                ? { findOneBy: async () => source }
                : {
                    findOneBy: async () => ({ userId: 'user' }),
                    find: async () => [],
                  },
    },
  };
  const requests = { findOne: jest.fn(async () => source) };
  const service = new WorkPermitService(
    repository as unknown as Repository<WorkPermit>,
    requests as unknown as WorkPermitRequestService,
  );
  return { service, dto, source, repository, file, approval, steps, requests };
}
describe('work permit issuance', () => {
  it('supports standalone registration and enforces scope and owner draft', async () => {
    const f = fixture();
    const p = await f.service.create(user, f.dto);
    expect(p.refId).toBeNull();
    await expect(
      f.service.update({ ...user, userId: 'other' }, 'permit', f.dto),
    ).rejects.toThrow('작성자');
    await expect(
      f.service.findOne({ ...user, companyId: 'B' }, 'permit'),
    ).rejects.toThrow();
    await f.service.syncApprovalStatus('A', 'permit', 'P', 'owner', 'approval');
    await expect(f.service.update(user, 'permit', f.dto)).rejects.toThrow('D');
  });
  it.each(['D', 'P', 'R', 'X'])(
    'rejects a %s request and permits only confirmed requests as references',
    async (status) => {
      const f = fixture();
      f.source.status = status;
      const dto = {
        ...f.dto,
        refModule: 'PERREQ',
        refId: 'request',
      };
      await expect(f.service.create(user, dto)).rejects.toThrow('확정');
      f.source.status = 'C';
      expect((await f.service.create(user, dto)).refId).toBe('request');
      await f.service.syncApprovalStatus(
        'A',
        'permit',
        'P',
        'owner',
        'approval',
      );
      expect(f.source.status).toBe('C');
      await f.service.syncApprovalStatus(
        'A',
        'permit',
        'C',
        'approver',
        'approval',
      );
      expect(f.source.status).toBe('C');
    },
  );
  it('requires general, matching sections and distinct approvers', async () => {
    const f = fixture();
    await expect(
      f.service.create(user, { ...f.dto, permitTypes: [] }),
    ).rejects.toThrow('일반');
    await expect(
      f.service.create(user, { ...f.dto, sections: [] }),
    ).rejects.toThrow('안전');
    await expect(
      f.service.create(user, { ...f.dto, approverId: 'issuer' }),
    ).rejects.toThrow('서로 다른');
  });
  it('retains individual edits rather than resetting template values', async () => {
    const f = fixture();
    await f.service.create(user, f.dto);
    const sections = [
      { ...f.dto.sections[0], specialRequirements: '현장별 보완' },
    ];
    const saved = await f.service.update(user, 'permit', {
      ...f.dto,
      sections,
    });
    expect(saved.sections[0].specialRequirements).toBe('현장별 보완');
    expect(PERMIT_TEMPLATES[0].specialRequirements).not.toBe('현장별 보완');
  });
  it('requires real files under allowed source groups', async () => {
    const f = fixture();
    await f.service.create(user, { ...f.dto, documentFiles: [] });
    await expect(f.service.approvalDraft(user, 'permit')).rejects.toThrow(
      '작업계획서',
    );
    await f.service.update(user, 'permit', f.dto);
    f.file.findOneBy.mockResolvedValue(null);
    await expect(f.service.approvalDraft(user, 'permit')).rejects.toThrow(
      '실제 파일',
    );
    f.file.findOneBy.mockResolvedValue({ itemNo: 1 } as AttachmentItem);
    await f.service.update(user, 'permit', {
      ...f.dto,
      documentFiles: f.dto.documentFiles.map((v) => ({
        ...v,
        attachmentId: 'foreign',
      })),
    });
    await expect(f.service.approvalDraft(user, 'permit')).rejects.toThrow(
      '실제 파일',
    );
  });
  it('includes request attachments without copying or constructing an approval line', async () => {
    const f = fixture();
    await f.service.create(user, {
      ...f.dto,
      refModule: 'PERREQ',
      refId: 'request',
      documentFiles: f.dto.documentFiles.map((v) => ({
        ...v,
        attachmentId: 'request-files',
      })),
    });
    const draft = await f.service.approvalDraft(user, 'permit');
    expect(draft).not.toHaveProperty('steps');
    expect(draft.sourceAttachmentIds).toEqual(['request-files']);
  });
  it('requires matching completed approval before official printing', async () => {
    const f = fixture();
    await f.service.create(user, f.dto);
    expect((await f.service.printData(user, 'permit')).approvals).toEqual([]);
    await f.service.syncApprovalStatus(
      'A',
      'permit',
      'C',
      'approver',
      'approval',
    );
    f.approval.findOneBy.mockResolvedValueOnce(null);
    await expect(f.service.printData(user, 'permit')).rejects.toThrow(
      '연결 결재',
    );
    expect((await f.service.printData(user, 'permit')).approvals).toHaveLength(
      2,
    );
    f.steps.find.mockResolvedValue([]);
    expect((await f.service.printData(user, 'permit')).approvals).toEqual([]);
  });
  it('validates real dates, hours and chronological ranges', () => {
    expect(() =>
      validatePermitData({ ...data, applicationDate: '20260229' }),
    ).toThrow();
    expect(() =>
      validatePermitData({ ...data, startTime: '20261106:25' }),
    ).toThrow();
    expect(() =>
      validatePermitData({ ...data, endTime: '20261105:09' }),
    ).toThrow();
  });
});

it('accepts the author as a permit issuer independently of the approval line', async () => {
  const f = fixture();
  const row = await f.service.create(
    user,
    Object.assign({}, f.dto, { issuerId: user.userId }),
  );
  expect(row.issuerId).toBe(user.userId);
  expect(await f.service.approvalDraft(user, 'permit')).not.toHaveProperty(
    'steps',
  );
});
