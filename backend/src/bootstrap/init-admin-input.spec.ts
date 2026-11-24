import { promptInitialAdminInput } from './init-admin-input';

function answers(values: string[]) {
  let position = 0;
  return jest.fn(async (_prompt: string, _secret?: boolean) => {
    if (position >= values.length) throw new Error('Unexpected question');
    return values[position++];
  });
}

it('collects only company code, user ID and password', async () => {
  const ask = answers([' ACME ', 'admin', ' secret ', ' secret ', 'y']);
  const config = await promptInitialAdminInput(ask);
  expect(config).toEqual({
    companyId: 'ACME',
    userId: 'admin',
    password: ' secret ',
  });
  expect(ask.mock.calls.filter((call) => call[1] === true)).toHaveLength(2);
  expect(ask).toHaveBeenCalledTimes(5);
});

it('rejects missing company code, duplicate password mismatch and cancellation', async () => {
  await expect(promptInitialAdminInput(answers([' ']))).rejects.toThrow('1~30자');
  await expect(
    promptInitialAdminInput(answers(['ACME', 'admin', 'secret', 'other'])),
  ).rejects.toThrow('일치하지');
  await expect(
    promptInitialAdminInput(answers(['ACME', 'admin', 'secret', 'secret', ''])),
  ).rejects.toThrow('취소');
});
