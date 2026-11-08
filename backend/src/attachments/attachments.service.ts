/** 회사별 첨부 그룹과 로컬 파일을 연결한다. 파일 처리는 문서 저장과 독립적이며 빈 헤더를 유지한다. */
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
import { findModule } from '../common/constants/modules';
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

/**
 * 첨부 그룹·파일 메타데이터와 실제 파일 저장소를 연계한다.
 * 모든 접근은 인증된 회사 범위로 제한하며, 파일 변경은 문서 저장과 별개로 처리한다.
 */
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
    if (!findModule(refModule))
      throw new BadRequestException('Invalid attachment module');
    const refId =
      dto.refId == null ? null : this.requireTrimmedString(dto.refId, 'refId');
    // 같은 회사·모듈·문서에 기존 그룹이 있으면 빈 그룹도 재사용한다.
    const existing =
      refId === null
        ? null
        : await this.attachmentRepository.findOneBy({
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
    // 그룹 내 현재 최대 번호 이후로 이번 요청의 파일 번호를 배정한다.
    const startItemNo = existingItems[0]?.itemNo ?? 0;
    const savedItems: AttachmentItem[] = [];

    for (const [index, file] of files.entries()) {
      const itemNo = startItemNo + index + 1;
      const fileExtension = extname(file.originalname).slice(0, 20) || null;
      // 원본명은 DB에 보관하고 실제 파일은 회사/모듈/첨부 그룹/UUID 파일명으로 저장한다.
      const storageName = `${randomUUID()}${fileExtension ?? ''}`;
      const storagePath = [
        userContext.companyId,
        attachment.refModule,
        attachment.attachmentId,
        storageName,
      ].join('/');
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      // 파일 저장 후 메타데이터를 기록한다. DB 실패 시 파일 보상 삭제는 수행하지 않는다.
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

    // 실제 파일과 상세 행을 즉시 삭제한다. 마지막 파일이어도 헤더와 문서의 연결은 유지한다.
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
    // UUID를 알아도 다른 회사의 첨부에 접근하지 못하도록 회사 조건을 함께 적용한다.
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

  // 파일 수신 완료 후 요청별 개수·합계 용량과 파일별 크기·요청 MIME을 검사한다.
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

  // 저장 경로·저장명은 응답에서 제외하고 DB bigint 문자열은 화면용 숫자로 변환한다.
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
