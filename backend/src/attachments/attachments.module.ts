import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentItem } from './entities/attachment-item.entity';
import { Attachment } from './entities/attachment.entity';
import { LocalFileStorageService } from './storage/local-file-storage.service';
import { S3FileStorageService } from './storage/s3-file-storage.service';
import { FILE_STORAGE } from './storage/storage.types';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, AttachmentItem])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalFileStorageService,
    S3FileStorageService,
    {
      provide: FILE_STORAGE,
      inject: [ConfigService, LocalFileStorageService, S3FileStorageService],
      useFactory: (
        configService: ConfigService,
        localStorage: LocalFileStorageService,
        s3Storage: S3FileStorageService,
      ) =>
        configService.get<string>('storage.driver') === 'minio'
          ? s3Storage
          : localStorage,
    },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
