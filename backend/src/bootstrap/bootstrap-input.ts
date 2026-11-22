/** 회사·관리자 정보는 실행 중 입력받으며 환경파일·명령 인자를 사용하지 않는다. */
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export interface BootstrapConfig {
  companyId: string;
  companyName: string;
  adminUserId: string;
  adminPassword: string;
  adminName: string;
  forcePassword: boolean;
}

type Ask = (prompt: string, secret?: boolean) => Promise<string>;

export async function promptBootstrapConfig(
  ask: Ask,
): Promise<BootstrapConfig> {
  const required = async (prompt: string, max: number) => {
    const value = (await ask(prompt)).trim();
    if (!value || value.length > max)
      throw new Error(`입력값은 1~${max}자여야 합니다: ${prompt}`);
    return value;
  };
  const companyId = await required('회사 코드: ', 30);
  const companyName = await required('회사명: ', 100);
  const adminUserId = await required('관리자 ID: ', 50);
  const adminName = await required('관리자 이름: ', 100);
  const adminPassword = await ask('초기 관리자 비밀번호: ', true);
  // bcrypt는 UTF-8 기준 72 byte를 초과하는 입력을 구분하지 못한다.
  if (!adminPassword.trim() || Buffer.byteLength(adminPassword, 'utf8') > 72)
    throw new Error(
      '비밀번호는 공백이 아닌 값으로 UTF-8 기준 72 byte 이하여야 합니다.',
    );
  if (adminPassword !== (await ask('비밀번호 확인: ', true)))
    throw new Error('비밀번호 확인이 일치하지 않습니다.');
  const reset = (
    await ask('기존 관리자 비밀번호도 재설정할까요? [y/N] ')
  ).trim();
  if (reset && !/^[yn]$/i.test(reset))
    throw new Error('비밀번호 재설정 여부는 y 또는 n을 입력하세요.');
  const confirm = (
    await ask('지정 회사의 관리자 정보·권한을 생성/갱신할까요? [y/N] ')
  ).trim();
  if (!/^y$/i.test(confirm)) throw new Error('초기 설정을 취소했습니다.');
  return {
    companyId,
    companyName,
    adminUserId,
    adminName,
    adminPassword,
    forcePassword: /^y$/i.test(reset),
  };
}

export async function readBootstrapInput(): Promise<BootstrapConfig> {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('회사·관리자 초기 설정은 대화형 터미널에서 실행하세요.');
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
    return await promptBootstrapConfig(async (prompt, secret = false) => {
      // readline이 입력 중 줄을 다시 그릴 때도 질문을 유지하도록 전달한다.
      // 비밀번호 질문까지 출력한 다음 사용자 입력의 화면 출력을 막는다.
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
