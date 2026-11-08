import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentItem } from './entities/attachment-item.entity';
import { Attachment } from './entities/attachment.entity';
import { LocalFileStorageService } from './storage/local-file-storage.service';
import { FILE_STORAGE } from './storage/storage.types';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment, AttachmentItem])],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalFileStorageService,
    { provide: FILE_STORAGE, useExisting: LocalFileStorageService },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
