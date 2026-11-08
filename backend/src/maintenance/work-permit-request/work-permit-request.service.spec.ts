import { Repository } from 'typeorm';
import { WorkPermitRequestService } from './work-permit-request.service';
import { WorkPermitRequest } from './entities/work-permit-request.entity';
import { UserContext } from '../../auth/types/user-context.type';
it('submits an owner request directly to C without a separate approval process and freezes it', async () => {
  const user = {
    companyId: 'A',
    userId: 'owner',
    accessScope: 'COMPANY_ALL',
  } as UserContext;
  const row = {
    status: 'D',
    createdBy: 'owner',
    data: {
      title: '작업',
      applicationDate: '20261106',
      applicantName: '신청인',
      organization: '소속',
      location: '현장',
      summary: '개요',
      startTime: '20261106:09',
      endTime: '20261106:18',
    },
  } as WorkPermitRequest;
  const q = { where: () => q, andWhere: () => q, getOne: async () => row };
  const save = jest.fn(async (v: WorkPermitRequest) => v);
  const service = new WorkPermitRequestService({
    createQueryBuilder: () => q,
    save,
  } as unknown as Repository<WorkPermitRequest>);
  await expect(
    service.submit({ ...user, userId: 'other' }, 'request'),
  ).rejects.toThrow('작성자');
  expect((await service.submit(user, 'request')).status).toBe('C');
  expect(save).toHaveBeenCalledTimes(1);
  await expect(
    service.update(user, 'request', { data: row.data }),
  ).rejects.toThrow('D');
  await expect(service.submit(user, 'request')).rejects.toThrow('D');
  await expect(service.remove(user, 'request')).rejects.toThrow('D');
});
