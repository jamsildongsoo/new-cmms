import {
  actor,
  closing,
  stockQueries,
  post,
} from '../../../test/support/purchase-inventory.fixture';

it('requires contiguous previous months to close and protects posting behind a later close', async () => {
  await closing.periodAction(actor, '202604', 'open');
  await expect(closing.periodAction(actor, '202604', 'close')).rejects.toThrow(
    '전월',
  );
  await closing.periodAction(actor, '202603', 'close');
  await closing.periodAction(actor, '202604', 'close');
  await closing.periodAction(actor, '202603', 'unlock');
  await expect(post('GENERAL_IN', '1', '10')).rejects.toThrow('후속 마감');
  await closing.periodAction(actor, '202604', 'unlock');
  await post('GENERAL_IN', '1', '10');
});
it('reports opening and period changes from stored amounts without repricing prior issues', async () => {
  await post('GENERAL_IN', '10', '5');
  await post('GENERAL_OUT', '2');
  await closing.periodAction(actor, '202603', 'close');
  await closing.periodAction(actor, '202604', 'open');
  await post('GENERAL_IN', '2', '20', { postingDate: '20260401' });
  const report = await closing.monthly(actor, '202604');
  expect(report.warehouses[0]).toMatchObject({
    openingQuantity: '8',
    openingAmount: '40',
    receiptQuantity: '2',
    receiptAmount: '40',
    closingQuantity: '10',
    closingAmount: '80',
  });
  expect((await stockQueries.balances(actor)).warehouses[0]).toMatchObject({
    quantity: '10.000000',
    amount: '80',
  });
});
it('scopes report rows to the receiving user site and isolates another company', async () => {
  await post('GENERAL_IN', '1', '10');
  await post('GENERAL_IN', '2', '20', { siteId: 'S2' });
  const siteUser = {
    ...actor,
    accessScope: 'OWN_DEPARTMENT' as const,
    siteId: 'S2',
  };
  expect((await closing.monthly(siteUser, '202603')).warehouses).toEqual([
    expect.objectContaining({ siteId: 'S2', closingAmount: '40' }),
  ]);
  expect(
    (await closing.monthly({ ...actor, companyId: 'OTHER' }, '202603'))
      .warehouses,
  ).toEqual([]);
});
