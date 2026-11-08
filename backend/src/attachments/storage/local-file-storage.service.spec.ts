import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStorageService } from './local-file-storage.service';
let root: string, storage: LocalFileStorageService;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'cmms-files-'));
  storage = new LocalFileStorageService(
    new ConfigService({ storage: { localRoot: root } }),
  );
});
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});
it('saves and reads a company/module/group UUID path and deletes only that file', async () => {
  const path = 'A/board/group/file.txt';
  const saved = await storage.save(
    {
      buffer: Buffer.from('content'),
      originalName: '원본.txt',
      size: 7,
      mimeType: 'text/plain',
    },
    path,
  );
  expect(saved.storagePath).toBe(path);
  expect((await storage.read(path)).toString()).toBe('content');
  await storage.delete(path);
  await expect(storage.read(path)).rejects.toThrow();
});
it.each([
  '',
  '.',
  '..',
  '../outside',
  '/tmp/outside',
  'A/../../outside',
  'A/../B/file',
  'A/./file',
  '..\\outside',
])('rejects unsafe paths for every operation: %s', async (path) => {
  await expect(
    storage.save(
      { buffer: Buffer.from('x'), originalName: 'x', size: 1, mimeType: null },
      path,
    ),
  ).rejects.toThrow('Invalid storage path');
  await expect(storage.read(path)).rejects.toThrow('Invalid storage path');
  await expect(storage.delete(path)).rejects.toThrow('Invalid storage path');
});
