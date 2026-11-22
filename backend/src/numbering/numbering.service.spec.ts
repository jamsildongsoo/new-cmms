import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../test/support/pglite';
import { UserContext } from '../auth/types/user-context.type';
import { MODULE_LIST, ModuleCode } from '../common/constants/modules';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AttachmentItem } from '../attachments/entities/attachment-item.entity';
import { AttachmentsService } from '../attachments/attachments.service';
import { FileStorage } from '../attachments/storage/storage.types';
import { PurchaseRequest } from '../purchase/purchase-request/entities/purchase-request.entity';
import { NumberingService } from './numbering.service';
import { NumberSequence } from './entities/number-sequence.entity';

jest.setTimeout(90000);
const actor = {
  companyId: 'A',
  userId: 'owner',
  accessScope: 'COMPANY_ALL',
} as UserContext;
const entities = [NumberSequence, Attachment, AttachmentItem, PurchaseRequest];
let db: DataSource, numbering: NumberingService, close: () => Promise<void>;
beforeAll(async () => {
  const fixture = await postgresTestDatabase(entities);
  db = fixture.dataSource;
  close = fixture.close;
  numbering = new NumberingService(db);
});
afterAll(async () => {
  if (close) await close();
});
beforeEach(async () => {
  for (const entity of entities) await db.getRepository(entity).clear();
});
const save =
  (attachmentId: string | null = null) =>
  async (id: string) =>
    db.getRepository(PurchaseRequest).save({
      companyId: actor.companyId,
      requestId: id,
      documentNo: '사용자 관리번호',
      title: '테스트',
      requesterId: actor.userId,
      attachmentId,
      createdBy: actor.userId,
    });
async function group(refModule = 'PURREQ', companyId = actor.companyId) {
  return db.getRepository(Attachment).save({
    companyId,
    attachmentId: randomUUID(),
    refModule,
    refId: null,
    createdBy: actor.userId,
  });
}

it('uses unique fixed module codes without separate prefixes or numbering flags', () => {
  expect(new Set(MODULE_LIST.map((module) => module.code)).size).toBe(
    MODULE_LIST.length,
  );
  for (const module of MODULE_LIST) {
    expect(module.code).toMatch(/^[A-Z]+$/);
    expect(module).not.toHaveProperty('documentPrefix');
    expect(module).not.toHaveProperty('rbac');
  }
});
it('increments by company, module and issuance month using the Korea month boundary', async () => {
  const end = new Date('2026-11-30T14:59:59Z'),
    next = new Date('2026-11-30T15:00:00Z');
  expect(await numbering.generateDocumentId('A', ModuleCode.PURORD, end)).toBe(
    'PURORD-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', ModuleCode.PURORD, end)).toBe(
    'PURORD-202611-00002',
  );
  expect(await numbering.generateDocumentId('B', ModuleCode.PURORD, end)).toBe(
    'PURORD-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', ModuleCode.PURREQ, end)).toBe(
    'PURREQ-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', ModuleCode.PURORD, next)).toBe(
    'PURORD-202612-00001',
  );
});
it('rejects unknown module codes and serial overflow without wrapping', async () => {
  await expect(
    numbering.generateDocumentId('A', 'UNKNOWN' as ModuleCode),
  ).rejects.toBeInstanceOf(BadRequestException);
  await db
    .getRepository(NumberSequence)
    .save({
      companyId: 'A',
      moduleCode: 'PURORD',
      yyyymm: '202611',
      lastSerial: 99999,
    });
  await expect(
    numbering.generateDocumentId(
      'A',
      ModuleCode.PURORD,
      new Date('2026-11-01'),
    ),
  ).rejects.toBeInstanceOf(ConflictException);
});
it('creates a new numbered document on every POST and preserves manual documentNo', async () => {
  const create = jest.fn(save());
  const first = await numbering.createDocument(
    actor,
    ModuleCode.PURREQ,
    create,
  );
  const second = await numbering.createDocument(
    actor,
    ModuleCode.PURREQ,
    create,
  );
  expect(first.requestId).not.toBe(second.requestId);
  expect(first.requestId).toMatch(/^PURREQ-\d{6}-00001$/);
  expect(second.requestId).toMatch(/^PURREQ-\d{6}-00002$/);
  expect(second.documentNo).toBe('사용자 관리번호');
  expect(create).toHaveBeenCalledTimes(2);
});
it('does not reuse a number after save failure', async () => {
  await expect(
    numbering.createDocument(actor, ModuleCode.PURREQ, () =>
      Promise.reject(new Error('save failed')),
    ),
  ).rejects.toThrow('save failed');
  const saved = await numbering.createDocument(
    actor,
    ModuleCode.PURREQ,
    save(),
  );
  expect(saved.requestId.endsWith('00002')).toBe(true);
});
it('saveDocument uses the supplied ID without advancing any sequence', async () => {
  const saved = await numbering.saveDocument(
    actor,
    ModuleCode.PURREQ,
    'manual-id',
    null,
    () => save()('manual-id'),
  );
  expect(saved.requestId).toBe('manual-id');
  expect(await db.getRepository(NumberSequence).count()).toBe(0);
});
it('creates separate unbound attachment groups and binds the chosen group on save', async () => {
  const service = new AttachmentsService(
    db.getRepository(Attachment),
    db.getRepository(AttachmentItem),
    {} as FileStorage,
    {} as ConfigService,
  );
  const first = await service.create(actor, {
    refModule: ModuleCode.PURREQ,
    refId: null,
  });
  const second = await service.create(actor, {
    refModule: ModuleCode.PURREQ,
    refId: null,
  });
  expect(first.attachmentId).not.toBe(second.attachmentId);
  const saved = await numbering.createDocument(
    actor,
    ModuleCode.PURREQ,
    save(first.attachmentId),
    first.attachmentId,
  );
  expect(
    (
      await service.create(actor, {
        refModule: ModuleCode.PURREQ,
        refId: saved.requestId,
      })
    ).attachmentId,
  ).toBe(first.attachmentId);
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ attachmentId: second.attachmentId })
    ).refId,
  ).toBeNull();
});
it('rejects foreign-company, other-module and already-bound attachment groups before saving', async () => {
  const foreign = await group('PURREQ', 'B'),
    other = await group('WRKORD'),
    bound = await group();
  await db
    .getRepository(Attachment)
    .update(
      { attachmentId: bound.attachmentId },
      { refId: 'PURREQ-202611-00999' },
    );
  for (const attachment of [foreign, other, bound]) {
    const create = jest.fn(save(attachment.attachmentId));
    await expect(
      numbering.createDocument(
        actor,
        ModuleCode.PURREQ,
        create,
        attachment.attachmentId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  }
});
it('preserves a saved document if subsequent attachment binding fails', async () => {
  const attachment = await group();
  await expect(
    numbering.createDocument(
      actor,
      ModuleCode.PURREQ,
      async (id) => {
        const result = await save(attachment.attachmentId)(id);
        await db
          .getRepository(Attachment)
          .update({ attachmentId: attachment.attachmentId }, { deleteYn: 'Y' });
        return result;
      },
      attachment.attachmentId,
    ),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(await db.getRepository(PurchaseRequest).count()).toBe(1);
});
it('does not rebind source attachments for linked approvals', async () => {
  const attachment = await group();
  await db
    .getRepository(Attachment)
    .update(
      { attachmentId: attachment.attachmentId },
      { refId: 'PURREQ-202611-00001' },
    );
  const result = await numbering.createDocument(
    actor,
    ModuleCode.APPROV,
    async (id) => ({ id }),
    attachment.attachmentId,
    true,
  );
  expect(result.id).toMatch(/^APPROV-/);
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ attachmentId: attachment.attachmentId })
    ).refId,
  ).toBe('PURREQ-202611-00001');
});
