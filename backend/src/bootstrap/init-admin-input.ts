import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export interface InitialAdminInput {
  companyId: string;
  userId: string;
  password: string;
}

type Ask = (prompt: string, secret?: boolean) => Promise<string>;

export async function promptInitialAdminInput(ask: Ask): Promise<InitialAdminInput> {
  const required = async (prompt: string, max: number) => {
    const value = (await ask(prompt)).trim();
    if (!value || value.length > max)
      throw new Error(`입력값은 1~${max}자여야 합니다: ${prompt}`);
    return value;
  };
  const companyId = await required('회사 코드: ', 30);
  const userId = await required('관리자 사용자 ID: ', 50);
  const password = await ask('초기 관리자 비밀번호: ', true);
  if (!password.trim() || Buffer.byteLength(password, 'utf8') > 72)
    throw new Error('비밀번호는 공백이 아닌 값으로 UTF-8 기준 72 byte 이하여야 합니다.');
  if (password !== (await ask('비밀번호 확인: ', true)))
    throw new Error('비밀번호 확인이 일치하지 않습니다.');
  const confirm = (await ask('지정 회사의 초기 관리자를 생성할까요? [y/N] ')).trim();
  if (!/^y$/i.test(confirm)) throw new Error('초기 설정을 취소했습니다.');
  return { companyId, userId, password };
}

export async function readInitialAdminInput(): Promise<InitialAdminInput> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('초기 관리자 생성은 대화형 터미널에서 실행하세요.');
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const terminal = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });
  const controller = new AbortController();
  terminal.on('SIGINT', () => controller.abort());
  try {
    return await promptInitialAdminInput(async (prompt, secret = false) => {
      muted = false;
      const answer = terminal.question(prompt, { signal: controller.signal });
      muted = secret;
      try {
        return await answer;
      } finally {
        muted = false;
        if (secret) process.stdout.write('\n');
      }
    });
  } finally {
    terminal.close();
    output.end();
  }
}
