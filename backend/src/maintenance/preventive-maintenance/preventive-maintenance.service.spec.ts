import { businessDate } from '../../common/utils/date.util';
import { Department } from '../../organization/departments/entities/department.entity';
import { Logger } from '@nestjs/common';
import { nextInspectionDate } from './inspection-date.util';
import { Repository } from 'typeorm';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';
import { PreventiveMaintenance } from './entities/preventive-maintenance.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { UserContext } from '../../auth/types/user-context.type';

function fixture() {
  const whereClauses: string[] = [];
  const document: PreventiveMaintenance = Object.assign(
    new PreventiveMaintenance(),
    {
      companyId: 'CR',
      pmId: 'test-pm',
      equipmentId: 'EQ1',
      inspectionDate: '20261105',
      nextInspectionDate: '20261212',
      items: [],
      createdBy: 'owner',
      status: 'D',
      title: '점검',
      documentNo: '',
      deleteYn: 'N',
    },
  );
  const repository = {
    findOneBy: jest.fn(async () => document as PreventiveMaintenance | null),
    createQueryBuilder: () => {
      const parameters: Record<string, unknown> = {};
      const builder = {
        where: jest.fn(function (
          this: object,
          _sql: string,
          values?: Record<string, unknown>,
        ) {
          Object.assign(parameters, values);
          return this;
        }),
        andWhere: jest.fn(function (
          this: object,
          sql: string,
          values?: Record<string, unknown>,
        ) {
          whereClauses.push(sql);
          Object.assign(parameters, values);
          return this;
        }),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => [[], 0]),
        getOne: async () =>
          parameters.companyId === document.companyId &&
          (!parameters.id || parameters.id === document.pmId) &&
          document.deleteYn === 'N'
            ? document
            : null,
        getMany: async () =>
          parameters.companyId === document.companyId &&
          document.deleteYn === 'N'
            ? [document]
            : [],
      };
      return builder;
    },
    create: (value: PreventiveMaintenance) => value,
    save: jest.fn(async (value: PreventiveMaintenance) => value),
    manager: { getRepository: () => ({ find: jest.fn(async () => []) }) },
  };
  const master = {
    equipmentId: 'EQ1',
    inspectionPeriod: 1,
    inspectionUnit: 'MONTH',
  };
  const equipment = {
    findOneBy: jest.fn(async () => master),
    find: jest.fn(async () => [master]),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  return {
    document,
    whereClauses,
    repository,
    master,
    equipment,
    service: new PreventiveMaintenanceService(
      repository as unknown as Repository<PreventiveMaintenance>,
      equipment as unknown as Repository<Equipment>,
    ),
  };
}
const actor = (userId: string) =>
  ({
    userId,
    companyId: 'CR',
    siteId: 'S1',
    deptId: 'D1',
    accessScope: 'COMPANY_ALL',
  }) as UserContext;

describe('PM detail actions', () => {
  it('searches only the selected list field', async () => {
    const { service, whereClauses } = fixture();
    await service.findAll(actor('owner'), {
      page: 1,
      searchType: 'equipmentId',
      search: 'EQ1',
    });
    expect(whereClauses).toContain('pm.equipmentId ILIKE :search');
  });
  it('persists the source attachment group and preserves it on unrelated saves', async () => {
    const { service } = fixture();
    expect(
      (
        await service.update(actor('owner'), 'test-pm', {
          attachmentId: 'pm-files',
        })
      ).attachmentId,
    ).toBe('pm-files');
    expect(
      (await service.update(actor('owner'), 'test-pm', { note: '수정' }))
        .attachmentId,
    ).toBe('pm-files');
  });

  it('allows the owner to save a draft and clear its optional management number', async () => {
    const { service } = fixture();
    const saved = await service.update(actor('owner'), 'test-pm', {
      title: '수정',
      documentNo: '',
    });
    expect(saved.title).toBe('수정');
    expect(saved.documentNo).toBe('');
  });

  it('rejects saving or deleting another user’s draft', async () => {
    const { service, repository } = fixture();
    await expect(
      service.update(actor('other'), 'test-pm', { title: '수정' }),
    ).rejects.toThrow('Only the owner');
    await expect(service.remove(actor('other'), 'test-pm')).rejects.toThrow(
      'Only the owner',
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects owner changes after submission', async () => {
    const { service, document } = fixture();
    document.status = 'P';
    await expect(
      service.update(actor('owner'), 'test-pm', { title: '수정' }),
    ).rejects.toThrow('Only draft');
    await expect(service.remove(actor('owner'), 'test-pm')).rejects.toThrow(
      'Only draft',
    );
  });

  it('creates a draft without requiring a management number', async () => {
    const { service, repository } = fixture();
    repository.findOneBy.mockResolvedValueOnce(null);
    const saved = await service.create(actor('owner'), {
      pmId: 'new-pm',
      inspectionDate: '20261115',
      title: '새 점검',
      equipmentId: 'EQ1',
    });
    expect(saved.documentNo).toBe('');
    expect(saved.createdBy).toBe('owner');
    expect(saved.status).toBe('D');
  });
});

describe('PM inspection dates and completion', () => {
  it.each([
    ['20260131', 1, 'MONTH', '20260228'],
    ['20240131', 1, 'MONTH', '20240229'],
    ['20240229', 1, 'YEAR', '20250228'],
    ['20261231', 1, 'DAY', '20270101'],
    ['20261105', 2, 'WEEK', '20261119'],
    ['20261105', null, 'MONTH', null],
  ])('calculates %s + %s %s as %s', (date, period, unit, expected) => {
    expect(
      nextInspectionDate(
        date as string,
        period as number | null,
        unit as string,
      ),
    ).toBe(expected);
  });

  it('calculates the initial next date and stores an explicit override on creation', async () => {
    const { service, repository } = fixture();
    const payload = {
      pmId: 'new-pm',
      title: '점검',
      equipmentId: 'EQ1',
      inspectionDate: '20260131',
    };
    repository.findOneBy.mockResolvedValueOnce(null);
    expect(
      (await service.create(actor('owner'), payload)).nextInspectionDate,
    ).toBe('20260228');
    repository.findOneBy.mockResolvedValueOnce(null);
    expect(
      (
        await service.create(actor('owner'), {
          ...payload,
          nextInspectionDate: '20260303',
        })
      ).nextInspectionDate,
    ).toBe('20260303');
  });

  it('limits equipment choices and lookups to the authenticated company', async () => {
    const { service, equipment } = fixture();
    await service.getOptions(actor('owner'));
    expect(equipment.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'CR', deleteYn: 'N' } }),
    );
    await service.update(actor('owner'), 'test-pm', { note: '수정' });
    expect(equipment.findOneBy).toHaveBeenCalledWith({
      companyId: 'CR',
      equipmentId: 'EQ1',
      deleteYn: 'N',
    });
  });

  it('rejects impossible dates', () => {
    expect(() => businessDate('20260229', false, 'inspectionDate')).toThrow(
      'valid date',
    );
    expect(() => businessDate('20260431', false, 'inspectionDate')).toThrow(
      'valid date',
    );
  });

  it('recalculates when the inspection date changes and retains manual values on unrelated edits', async () => {
    const { service } = fixture();
    expect(
      (
        await service.update(actor('owner'), 'test-pm', {
          inspectionDate: '20260131',
        })
      ).nextInspectionDate,
    ).toBe('20260228');
    expect(
      (
        await service.update(actor('owner'), 'test-pm', {
          nextInspectionDate: '20260303',
        })
      ).nextInspectionDate,
    ).toBe('20260303');
    expect(
      (await service.update(actor('owner'), 'test-pm', { note: '비고' }))
        .nextInspectionDate,
    ).toBe('20260303');
  });

  it('keeps next date empty when the equipment has no cycle', async () => {
    const { service, master } = fixture();
    master.inspectionPeriod = 0;
    expect(
      (
        await service.update(actor('owner'), 'test-pm', {
          inspectionDate: '20261105',
          nextInspectionDate: '20261210',
        })
      ).nextInspectionDate,
    ).toBeNull();
  });

  it('stores exactly the four detail fields and supports removing all items', async () => {
    const { service } = fixture();
    const item = {
      name: ' 압력 ',
      standardValue: ' 10 ',
      inspectionValue: ' 9 ',
      unit: ' bar ',
    };
    const saved = await service.update(actor('owner'), 'test-pm', {
      items: [item],
    });
    expect(saved.items).toEqual([
      { name: '압력', standardValue: '10', inspectionValue: '9', unit: 'bar' },
    ]);
    expect(
      (await service.update(actor('owner'), 'test-pm', { items: [] })).items,
    ).toEqual([]);
  });

  it.each(['P', 'R', 'X'] as const)(
    'syncs %s to PM without changing equipment dates',
    async (status) => {
      const { service, document, equipment } = fixture();
      await service.syncApprovalStatus('CR', 'test-pm', status, 'approver');
      expect(document.status).toBe(status);
      expect(equipment.update).not.toHaveBeenCalled();
    },
  );

  it('copies stored dates without recalculation only after PM is confirmed', async () => {
    const { service, repository, equipment } = fixture();
    await service.syncApprovalStatus('CR', 'test-pm', 'C', 'approver');
    expect(repository.save.mock.invocationCallOrder[0]).toBeLessThan(
      equipment.update.mock.invocationCallOrder[0],
    );
    expect(equipment.update).toHaveBeenCalledWith(
      { companyId: 'CR', equipmentId: 'EQ1', deleteYn: 'N' },
      expect.objectContaining({
        inspectionDate: '20261105',
        nextInspectionDate: '20261212',
        updatedBy: 'approver',
      }),
    );
  });

  it('retains PM completion and logs identifiers if the equipment update fails', async () => {
    const { service, document, equipment } = fixture();
    equipment.update.mockRejectedValueOnce(new Error('disk failure') as never);
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await expect(
        service.syncApprovalStatus('CR', 'test-pm', 'C', 'approver'),
      ).rejects.toThrow('disk failure');
      expect(document.status).toBe('C');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          pmId: 'test-pm',
          companyId: 'CR',
          equipmentId: 'EQ1',
          stage: 'syncEquipmentInspectionDates',
        }),
      );
    } finally {
      log.mockRestore();
    }
  });
});

describe('PM manual assessment', () => {
  it('allows incomplete draft saves but blocks submission', async () => {
    const { service } = fixture();
    expect(
      (
        await service.update(actor('owner'), 'test-pm', {
          result: null,
          deptId: null,
          inspectorId: null,
        })
      ).result,
    ).toBeNull();
    await expect(
      service.assertCanSubmit(actor('owner'), 'test-pm'),
    ).rejects.toThrow('판정');
  });
  it('accepts NOK with an independently selected inspector and preserves owner checks', async () => {
    const { service, document, equipment } = fixture();
    await service.update(actor('owner'), 'test-pm', {
      result: 'NOK',
      deptId: 'D1',
      inspectorId: 'inspector',
    });
    await expect(
      service.assertCanSubmit(actor('owner'), 'test-pm'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertCanSubmit(actor('inspector'), 'test-pm'),
    ).rejects.toThrow('Only the owner');
    await service.syncApprovalStatus('CR', 'test-pm', 'C', 'approver');
    expect(document.result).toBe('NOK');
    expect(equipment.update).toHaveBeenCalled();
  });
});

describe('PM historical references', () => {
  it('keeps historical IDs while using active-only name lookups', async () => {
    const { service, document, repository } = fixture();
    document.deptId = 'OLD-D';
    document.inspectorId = 'OLD-U';
    const departments = {
      find: jest.fn(async (_query: unknown) => []),
    };
    const users = {
      find: jest.fn(async (_query: unknown) => []),
    };
    Object.assign(repository.manager, {
      getRepository: (entity: unknown) =>
        entity === Department ? departments : users,
    });
    expect(await service.findOne(actor('owner'), 'test-pm')).toMatchObject({
      deptId: 'OLD-D',
      inspectorId: 'OLD-U',
      deptName: null,
      inspectorName: null,
    });
    for (const repo of [departments, users]) {
      const query = repo.find.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(query.where.companyId).toBe('CR');
      expect(query.where.deleteYn).toBe('N');
    }
  });
});

describe('PM required inspection date', () => {
  it.each([null, '', undefined])(
    'rejects a missing creation date: %s',
    async (value) => {
      const { service, repository } = fixture();
      repository.findOneBy.mockResolvedValueOnce(null);
      await expect(
        service.create(actor('owner'), {
          pmId: 'new',
          title: '점검',
          equipmentId: 'EQ1',
          inspectionDate: value as never,
        }),
      ).rejects.toThrow('점검일');
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  it('does not clear an existing date and does not submit a legacy document with no date', async () => {
    const { service, repository, document } = fixture();
    await expect(
      service.update(actor('owner'), 'test-pm', {
        inspectionDate: null as never,
      }),
    ).rejects.toThrow('점검일');
    expect(repository.save).not.toHaveBeenCalled();
    document.inspectionDate = null;
    await expect(
      service.assertCanSubmit(actor('owner'), 'test-pm'),
    ).rejects.toThrow('점검일');
  });
});
