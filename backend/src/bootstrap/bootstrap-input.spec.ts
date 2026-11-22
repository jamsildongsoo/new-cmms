import { promptBootstrapConfig } from './bootstrap-input';

function answers(values: string[]) {
  let position = 0;
  return jest.fn(async (_prompt: string, _secret?: boolean) => {
    if (position >= values.length) throw new Error('Unexpected question');
    return values[position++];
  });
}
const base = [' ACME ', '회사명', 'owner', '관리자', ' secret ', ' secret '];
it('collects input, hides both password prompts and preserves password spaces', async () => {
  const ask = answers([...base, '', 'y']);
  const config = await promptBootstrapConfig(ask);
  expect(config.companyId).toBe('ACME');
  expect(config.adminPassword).toBe(' secret ');
  expect(config.forcePassword).toBe(false);
  expect(ask.mock.calls.filter((call) => call[1] === true)).toHaveLength(2);
});
it('requires explicit password reset and final confirmation', async () => {
  expect(
    (await promptBootstrapConfig(answers([...base, 'Y', 'Y']))).forcePassword,
  ).toBe(true);
  await expect(
    promptBootstrapConfig(answers([...base, '', ''])),
  ).rejects.toThrow('취소');
  await expect(
    promptBootstrapConfig(answers([...base, 'invalid'])),
  ).rejects.toThrow('y 또는 n');
});
it('rejects missing and oversized company input before asking for secrets', async () => {
  await expect(promptBootstrapConfig(answers(['  ']))).rejects.toThrow(
    '1~30자',
  );
  await expect(
    promptBootstrapConfig(answers(['x'.repeat(31)])),
  ).rejects.toThrow('1~30자');
});
it('rejects mismatched, empty and bcrypt-truncated passwords', async () => {
  await expect(
    promptBootstrapConfig(answers([...base.slice(0, 5), 'different'])),
  ).rejects.toThrow('일치하지');
  for (const value of [' ', '가'.repeat(25)]) {
    await expect(
      promptBootstrapConfig(answers([...base.slice(0, 4), value])),
    ).rejects.toThrow('72 byte');
  }
});
