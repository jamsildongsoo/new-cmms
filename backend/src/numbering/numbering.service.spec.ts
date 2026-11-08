import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { postgresTestDatabase } from '../../test/support/pglite';
import { UserContext } from '../auth/types/user-context.type';
import { MODULE_LIST } from '../common/constants/modules';
import { Attachment } from '../attachments/entities/attachment.entity';
import { AttachmentItem } from '../attachments/entities/attachment-item.entity';
import { AttachmentsService } from '../attachments/attachments.service';
import { FileStorage } from '../attachments/storage/storage.types';
import { PurchaseRequest } from '../purchase/purchase-request/entities/purchase-request.entity';
import { NumberingService } from './numbering.service';
import { NumberSequence } from './entities/number-sequence.entity';
import { DocumentRequest } from './entities/document-request.entity';

jest.setTimeout(90000);
const actor = {
  companyId: 'A',
  userId: 'owner',
  accessScope: 'COMPANY_ALL',
} as UserContext;
const entities = [
  NumberSequence,
  DocumentRequest,
  Attachment,
  AttachmentItem,
  PurchaseRequest,
];
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
const read = async (id: string) => {
  const row = await db
    .getRepository(PurchaseRequest)
    .findOneBy({ companyId: actor.companyId, requestId: id, deleteYn: 'N' });
  if (!row) throw new NotFoundException();
  return row;
};
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
async function group(
  refModule = 'purchase_request',
  companyId = actor.companyId,
) {
  return db.getRepository(Attachment).save({
    companyId,
    attachmentId: randomUUID(),
    refModule,
    refId: null,
    createdBy: actor.userId,
  });
}

it('uses a single unique prefix definition for document modules including the explicit BORD prefix', () => {
  const prefixes = MODULE_LIST.flatMap((m) =>
    'documentPrefix' in m ? [m.documentPrefix] : [],
  );
  expect(prefixes).toHaveLength(10);
  expect(new Set(prefixes).size).toBe(10);
  expect(prefixes.every((p) => p === 'BORD' || /^[A-Z]{6}$/.test(p))).toBe(
    true,
  );
});
it('increments by company, module and issuance month using the Korea month boundary', async () => {
  const end = new Date('2026-11-30T14:59:59Z'),
    next = new Date('2026-11-30T15:00:00Z');
  expect(await numbering.generateDocumentId('A', 'purchase_order', end)).toBe(
    'PURORD-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', 'purchase_order', end)).toBe(
    'PURORD-202611-00002',
  );
  expect(await numbering.generateDocumentId('B', 'purchase_order', end)).toBe(
    'PURORD-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', 'purchase_request', end)).toBe(
    'PURREQ-202611-00001',
  );
  expect(await numbering.generateDocumentId('A', 'purchase_order', next)).toBe(
    'PURORD-202612-00001',
  );
});
it('rejects non-document modules and serial overflow without wrapping', async () => {
  await expect(
    numbering.generateDocumentId('A', 'material'),
  ).rejects.toBeInstanceOf(BadRequestException);
  await db.getRepository(NumberSequence).save({
    companyId: 'A',
    moduleCode: 'PURORD',
    yyyymm: '202611',
    lastSerial: 99999,
  });
  await expect(
    numbering.generateDocumentId('A', 'purchase_order', new Date('2026-11-01')),
  ).rejects.toBeInstanceOf(ConflictException);
});
it('returns the same saved document on a lost-response retry, preserving manual documentNo', async () => {
  const key = randomUUID(),
    create = jest.fn(save());
  const first = await numbering.createDocument(
    actor,
    'purchase_request',
    key,
    create,
    read,
  );
  const second = await numbering.createDocument(
    actor,
    'purchase_request',
    key,
    create,
    read,
  );
  expect(second.requestId).toBe(first.requestId);
  expect(second.documentNo).toBe('사용자 관리번호');
  expect(first.requestId).toMatch(/^PURREQ-\d{6}-00001$/);
  expect(create).toHaveBeenCalledTimes(1);
  expect(await db.getRepository(NumberSequence).count()).toBe(1);
  await expect(
    numbering.createDocument(
      { ...actor, userId: 'other' },
      'purchase_request',
      key,
      create,
      read,
    ),
  ).rejects.toBeInstanceOf(ConflictException);
});
it('retains a reserved number after save failure and uses it again only for the same request', async () => {
  const key = randomUUID();
  await expect(
    numbering.createDocument(
      actor,
      'purchase_request',
      key,
      () => Promise.reject(new Error('save failed')),
      read,
    ),
  ).rejects.toThrow('save failed');
  const reservation = await db
    .getRepository(DocumentRequest)
    .findOneByOrFail({ requestKey: key });
  const saved = await numbering.createDocument(
    actor,
    'purchase_request',
    key,
    save(),
    read,
  );
  expect(saved.requestId).toBe(reservation.documentId);
  const other = await numbering.createDocument(
    actor,
    'purchase_request',
    randomUUID(),
    save(),
    read,
  );
  expect(other.requestId.endsWith('00002')).toBe(true);
});
it('rejects a missing request key before issuing any number', async () => {
  await expect(
    numbering.createDocument(
      actor,
      'purchase_request',
      undefined as unknown as string,
      save(),
      read,
    ),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(await db.getRepository(NumberSequence).count()).toBe(0);
});
it('rejects a simultaneous duplicate request while the original saves', async () => {
  const key = randomUUID();
  let release!: () => void, started!: () => void;
  const entered = new Promise<void>((r) => {
    started = r;
  });
  const pending = numbering.createDocument(
    actor,
    'purchase_request',
    key,
    async (id) => {
      started();
      await new Promise<void>((r) => {
        release = r;
      });
      return save()(id);
    },
    read,
  );
  await entered;
  try {
    await expect(
      numbering.createDocument(actor, 'purchase_request', key, save(), read),
    ).rejects.toBeInstanceOf(ConflictException);
  } finally {
    release();
  }
  const first = await pending;
  expect(
    (
      await numbering.createDocument(
        actor,
        'purchase_request',
        key,
        save(),
        read,
      )
    ).requestId,
  ).toBe(first.requestId);
});
it('creates separate null-reference UUID groups and reuses only a concrete document reference', async () => {
  const service = new AttachmentsService(
    db.getRepository(Attachment),
    db.getRepository(AttachmentItem),
    {} as FileStorage,
    {} as ConfigService,
  );
  const first = await service.create(actor, {
    refModule: 'purchase_request',
    refId: null,
  });
  const second = await service.create(actor, {
    refModule: 'purchase_request',
    refId: null,
  });
  expect(first.attachmentId).not.toBe(second.attachmentId);
  expect(first.refId).toBeNull();
  const saved = await numbering.createDocument(
    actor,
    'purchase_request',
    randomUUID(),
    save(first.attachmentId),
    read,
    first.attachmentId,
  );
  expect(
    (
      await service.create(actor, {
        refModule: 'purchase_request',
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
  const foreign = await group('purchase_request', 'B'),
    other = await group('work_order'),
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
        'purchase_request',
        randomUUID(),
        create,
        read,
        attachment.attachmentId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  }
});
it('preserves a saved document after bind failure and repairs the connection on retry', async () => {
  const attachment = await group(),
    key = randomUUID();
  const create = jest.fn(async (id: string) => {
    const result = await save(attachment.attachmentId)(id);
    await db
      .getRepository(Attachment)
      .update({ attachmentId: attachment.attachmentId }, { deleteYn: 'Y' });
    return result;
  });
  await expect(
    numbering.createDocument(
      actor,
      'purchase_request',
      key,
      create,
      read,
      attachment.attachmentId,
    ),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(await db.getRepository(PurchaseRequest).count()).toBe(1);
  await db
    .getRepository(Attachment)
    .update({ attachmentId: attachment.attachmentId }, { deleteYn: 'N' });
  const retry = await numbering.createDocument(
    actor,
    'purchase_request',
    key,
    create,
    read,
    attachment.attachmentId,
  );
  expect(create).toHaveBeenCalledTimes(1);
  expect(
    (
      await db
        .getRepository(Attachment)
        .findOneByOrFail({ attachmentId: attachment.attachmentId })
    ).refId,
  ).toBe(retry.requestId);
});
it('does not rebind the source attachment group for linked approvals', async () => {
  const attachment = await group();
  await db
    .getRepository(Attachment)
    .update(
      { attachmentId: attachment.attachmentId },
      { refId: 'PURREQ-202611-00001' },
    );
  const result = await numbering.createDocument(
    actor,
    'approval',
    randomUUID(),
    async (id) => ({ id, attachmentId: attachment.attachmentId }),
    async () => {
      throw new NotFoundException();
    },
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
