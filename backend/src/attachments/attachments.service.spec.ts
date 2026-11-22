import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../test/support/pglite';
import type { UserContext } from '../auth/types/user-context.type';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { AttachmentItem } from './entities/attachment-item.entity';
import { FileStorage, StoredFile } from './storage/storage.types';
jest.setTimeout(90000);
const actor = (companyId = 'A') =>
  ({ companyId, userId: 'owner' }) as UserContext;
const storage = {
  save: jest.fn(async (_file: StoredFile, storagePath: string) => ({
    storageName: 'file.txt',
    storagePath,
  })),
  read: jest.fn(async () => Buffer.from('x')),
  delete: jest.fn(async () => undefined),
} satisfies FileStorage;
let db: DataSource, service: AttachmentsService, close: () => Promise<void>;
beforeAll(async () => {
  const fixture = await postgresTestDatabase([Attachment, AttachmentItem]);
  db = fixture.dataSource;
  close = fixture.close;
  service = new AttachmentsService(
    db.getRepository(Attachment),
    db.getRepository(AttachmentItem),
    storage,
    new ConfigService({
      storage: {
        maxFilesPerUpload: 10,
        maxSizeBytes: 100,
        maxUploadTotalBytes: 100,
        allowedMimeTypes: ['text/plain'],
      },
    }),
  );
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  await db.getRepository(AttachmentItem).clear();
  await db.getRepository(Attachment).clear();
  jest.clearAllMocks();
});
it('rejects unregistered module names before creating a group or writing a path', async () => {
  for (const refModule of ['../../B', '/tmp', 'unknown', 'toString'])
    await expect(
      service.create(actor(), { refModule, refId: null }),
    ).rejects.toThrow('Invalid attachment module');
  expect(await db.getRepository(Attachment).count()).toBe(0);
  expect(storage.save).not.toHaveBeenCalled();
});
it('checks the authenticated company before list/upload/download/delete and never calls storage for foreign files', async () => {
  const group = await service.create(actor('B'), {
    refModule: "BORD",
    refId: null,
  });
  await expect(service.findItems(actor(), group.attachmentId)).rejects.toThrow(
    'not found',
  );
  await expect(
    service.uploadItems(actor(), group.attachmentId, [
      {
        buffer: Buffer.from('x'),
        originalname: 'x.txt',
        mimetype: 'text/plain',
        size: 1,
      },
    ]),
  ).rejects.toThrow('not found');
  await expect(
    service.downloadItem(actor(), group.attachmentId, 1),
  ).rejects.toThrow('not found');
  await expect(
    service.removeItem(actor(), group.attachmentId, 1),
  ).rejects.toThrow('not found');
  expect(storage.save).not.toHaveBeenCalled();
  expect(storage.read).not.toHaveBeenCalled();
  expect(storage.delete).not.toHaveBeenCalled();
});
it('stores files below the company/module/group path and keeps an empty group after the final file is removed', async () => {
  const group = await service.create(actor(), {
    refModule: "BORD",
    refId: null,
  });
  const items = await service.uploadItems(actor(), group.attachmentId, [
    {
      buffer: Buffer.from('x'),
      originalname: '원본.txt',
      mimetype: 'text/plain',
      size: 1,
    },
  ]);
  expect(storage.save.mock.calls[0][1]).toMatch(
    new RegExp(`^A/BORD/${group.attachmentId}/[0-9a-f-]+\\.txt$`),
  );
  expect(items[0].originalName).toBe('원본.txt');
  await service.removeItem(actor(), group.attachmentId, items[0].itemNo);
  expect(await service.findItems(actor(), group.attachmentId)).toEqual([]);
  expect(await db.getRepository(Attachment).count()).toBe(1);
  expect(storage.delete).toHaveBeenCalledTimes(1);
});
