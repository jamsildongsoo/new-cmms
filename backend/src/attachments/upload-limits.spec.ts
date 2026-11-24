import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AttachmentsModule } from './attachments.module';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { AttachmentItem } from './entities/attachment-item.entity';

describe('configured upload reception limits without Docker or Nginx', () => {
  let app: INestApplication;
  const uploadItems = jest.fn().mockResolvedValue([]);
  const downloadItem = jest.fn().mockResolvedValue({
    item: { originalName: '설비 점검표.txt', mimeType: 'text/plain' },
    buffer: Buffer.from('x'),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          skipProcessEnv: true,
          validate: () => ({
            storage: { maxSizeBytes: 4, maxFilesPerUpload: 1 },
          }),
        }),
        AttachmentsModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Attachment))
      .useValue({})
      .overrideProvider(getRepositoryToken(AttachmentItem))
      .useValue({})
      .overrideProvider(AttachmentsService)
      .useValue({ uploadItems, downloadItem })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => uploadItems.mockClear());
  afterAll(async () => {
    if (app) await app.close();
  });

  it('rejects an oversized file before invoking the attachment service', async () => {
    await request(app.getHttpServer())
      .post('/attachments/group/items')
      .attach('files', Buffer.from('12345'), 'file.txt')
      .expect(413);
    expect(uploadItems).not.toHaveBeenCalled();
  });

  it('rejects excessive file count before invoking the attachment service', async () => {
    await request(app.getHttpServer())
      .post('/attachments/group/items')
      .attach('files', Buffer.from('1'), 'one.txt')
      .attach('files', Buffer.from('2'), 'two.txt')
      .expect(400);
    expect(uploadItems).not.toHaveBeenCalled();
  });

  it('accepts a file below the configured limit for further service validation', async () => {
    await request(app.getHttpServer())
      .post('/attachments/group/items')
      .attach('files', Buffer.from('123'), 'file.txt')
      .expect(201);
    expect(uploadItems).toHaveBeenCalledTimes(1);
  });

  it('passes a UTF-8 filename from multipart upload to the service', async () => {
    await request(app.getHttpServer())
      .post('/attachments/group/items')
      .attach('files', Buffer.from('x'), '설비 점검표.txt')
      .expect(201);
    expect(uploadItems.mock.calls[0][2][0].originalname).toBe(
      '설비 점검표.txt',
    );
  });

  it('returns an encoded UTF-8 download filename', async () => {
    const response = await request(app.getHttpServer())
      .get('/attachments/group/items/1/download')
      .expect(200);
    expect(response.headers['content-disposition']).toContain(
      "filename*=UTF-8''%EC%84%A4%EB%B9%84%20%EC%A0%90%EA%B2%80%ED%91%9C.txt",
    );
  });
});
