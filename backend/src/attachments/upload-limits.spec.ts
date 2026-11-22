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
      .useValue({ uploadItems })
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
});
