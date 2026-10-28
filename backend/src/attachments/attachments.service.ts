import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Repository } from 'typeorm';
import { UserContext } from '../auth/types/user-context.type';
import { AttachmentItemResponseDto } from './dto/attachment-item-response.dto';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AttachmentItem } from './entities/attachment-item.entity';
import { Attachment } from './entities/attachment.entity';
import { FILE_STORAGE, type FileStorage } from './storage/storage.types';

export interface UploadedAttachmentFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface AttachmentDownload {
  item: AttachmentItem;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(AttachmentItem)
    private readonly attachmentItemRepository: Repository<AttachmentItem>,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: FileStorage,
    private readonly configService: ConfigService,
  ) {}

  async create(
    userContext: UserContext,
    dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    const refModule = this.requireTrimmedString(dto.refModule, 'refModule');
    const refId = this.requireTrimmedString(dto.refId, 'refId');
    const existing = await this.attachmentRepository.findOneBy({
      companyId: userContext.companyId,
      refModule,
      refId,
      deleteYn: 'N',
    });
    if (existing) {
      return this.toAttachmentResponse(existing);
    }

    const attachment = this.attachmentRepository.create({
      companyId: userContext.companyId,
      attachmentId: randomUUID(),
      refModule,
      refId,
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toAttachmentResponse(
      await this.attachmentRepository.save(attachment),
    );
  }

  async findItems(
    userContext: UserContext,
    attachmentId: string,
  ): Promise<AttachmentItemResponseDto[]> {
    await this.findAttachmentOrThrow(userContext.companyId, attachmentId);
    const items = await this.attachmentItemRepository.find({
      where: {
        companyId: userContext.companyId,
        attachmentId,
      },
      order: {
        itemNo: 'ASC',
      },
    });

    return items.map((item) => this.toItemResponse(item));
  }

  async uploadItems(
    userContext: UserContext,
    attachmentId: string,
    files: UploadedAttachmentFile[],
  ): Promise<AttachmentItemResponseDto[]> {
    const attachment = await this.findAttachmentOrThrow(
      userContext.companyId,
      attachmentId,
    );
    this.validateFiles(files);

    const existingItems = await this.attachmentItemRepository.find({
      where: {
        companyId: userContext.companyId,
        attachmentId,
      },
      order: {
        itemNo: 'DESC',
      },
    });
    const startItemNo = existingItems[0]?.itemNo ?? 0;
    const savedItems: AttachmentItem[] = [];

    for (const [index, file] of files.entries()) {
      const itemNo = startItemNo + index + 1;
      const fileExtension = extname(file.originalname).slice(0, 20) || null;
      const storageName = `${randomUUID()}${fileExtension ?? ''}`;
      const storagePath = [
        userContext.companyId,
        attachment.refModule,
        attachment.attachmentId,
        storageName,
      ].join('/');
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      const storedFile = await this.fileStorage.save(
        {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype || null,
          size: file.size,
        },
        storagePath,
      );
      const item = this.attachmentItemRepository.create({
        companyId: userContext.companyId,
        attachmentId,
        itemNo,
        originalName: file.originalname,
        storageName: storedFile.storageName,
        fileExtension,
        mimeType: file.mimetype || null,
        size: String(file.size),
        checksum,
        storagePath: storedFile.storagePath,
      });

      savedItems.push(await this.attachmentItemRepository.save(item));
    }

    attachment.updatedBy = userContext.userId;
    attachment.updatedAt = new Date();
    await this.attachmentRepository.save(attachment);

    return savedItems.map((item) => this.toItemResponse(item));
  }

  async downloadItem(
    userContext: UserContext,
    attachmentId: string,
    itemNo: number,
  ): Promise<AttachmentDownload> {
    await this.findAttachmentOrThrow(userContext.companyId, attachmentId);
    const item = await this.findItemOrThrow(
      userContext.companyId,
      attachmentId,
      itemNo,
    );

    return {
      item,
      buffer: await this.fileStorage.read(item.storagePath),
    };
  }

  async removeItem(
    userContext: UserContext,
    attachmentId: string,
    itemNo: number,
  ): Promise<AttachmentItemResponseDto> {
    const attachment = await this.findAttachmentOrThrow(
      userContext.companyId,
      attachmentId,
    );
    const item = await this.findItemOrThrow(
      userContext.companyId,
      attachmentId,
      itemNo,
    );

    await this.fileStorage.delete(item.storagePath);
    await this.attachmentItemRepository.remove(item);

    attachment.updatedBy = userContext.userId;
    attachment.updatedAt = new Date();
    await this.attachmentRepository.save(attachment);

    return this.toItemResponse(item);
  }

  private async findAttachmentOrThrow(
    companyId: string,
    attachmentId: string,
  ): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOneBy({
      companyId,
      attachmentId: this.requireTrimmedString(attachmentId, 'attachmentId'),
      deleteYn: 'N',
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  private async findItemOrThrow(
    companyId: string,
    attachmentId: string,
    itemNo: number,
  ): Promise<AttachmentItem> {
    if (!Number.isInteger(itemNo) || itemNo < 1) {
      throw new BadRequestException('itemNo must be a positive integer');
    }

    const item = await this.attachmentItemRepository.findOneBy({
      companyId,
      attachmentId,
      itemNo,
    });

    if (!item) {
      throw new NotFoundException('Attachment item not found');
    }

    return item;
  }

  private validateFiles(files: UploadedAttachmentFile[]): void {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('files are required');
    }

    const maxFiles = this.configService.getOrThrow<number>(
      'storage.maxFilesPerUpload',
    );
    if (files.length > maxFiles) {
      throw new BadRequestException(`Maximum ${maxFiles} files are allowed`);
    }

    const maxSize = this.configService.getOrThrow<number>(
      'storage.maxSizeBytes',
    );
    const maxTotalSize = this.configService.getOrThrow<number>(
      'storage.maxUploadTotalBytes',
    );
    const allowedMimeTypes = new Set(
      this.configService.getOrThrow<string[]>('storage.allowedMimeTypes'),
    );
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > maxTotalSize) {
      throw new BadRequestException('Total upload size is too large');
    }

    for (const file of files) {
      if (file.size > maxSize) {
        throw new BadRequestException(`${file.originalname} is too large`);
      }
      if (!allowedMimeTypes.has(file.mimetype)) {
        throw new BadRequestException(
          `${file.originalname} type is not allowed`,
        );
      }
    }
  }

  private requireTrimmedString(
    value: string | undefined,
    fieldName: string,
  ): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return value.trim();
  }

  private toAttachmentResponse(attachment: Attachment): AttachmentResponseDto {
    return {
      companyId: attachment.companyId,
      attachmentId: attachment.attachmentId,
      refModule: attachment.refModule,
      refId: attachment.refId,
      deleteYn: attachment.deleteYn,
      createdBy: attachment.createdBy,
      createdAt: attachment.createdAt,
      updatedBy: attachment.updatedBy,
      updatedAt: attachment.updatedAt,
    };
  }

  private toItemResponse(item: AttachmentItem): AttachmentItemResponseDto {
    return {
      companyId: item.companyId,
      attachmentId: item.attachmentId,
      itemNo: item.itemNo,
      originalName: item.originalName,
      fileExtension: item.fileExtension,
      mimeType: item.mimeType,
      size: Number(item.size),
      checksum: item.checksum,
    };
  }
}
