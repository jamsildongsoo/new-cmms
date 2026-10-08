import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { DocumentStatus } from '../../common/constants/document-status';
import { assertDraft } from '../../common/utils/document-status.util';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseRequest } from './entities/purchase-request.entity';

@Injectable()
export class PurchaseRequestService {
  constructor(
    @InjectRepository(PurchaseRequest)
    private readonly repository: Repository<PurchaseRequest>,
  ) {}

  findAll(userContext: UserContext) {
    return this.repository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userContext: UserContext, requestId: string) {
    return this.findActiveOrThrow(userContext.companyId, requestId);
  }

  async create(userContext: UserContext, dto: CreatePurchaseRequestDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      requestId: dto.requestId,
    });
    if (existing) {
      throw new ConflictException('Purchase request already exists');
    }

    return this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        requestId: dto.requestId,
        documentNo: dto.documentNo.trim(),
        title: dto.title.trim(),
        typeCode: dto.typeCode?.trim() || null,
        requiredDate: dto.requiredDate?.trim() || null,
        content: dto.content?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        note: dto.note?.trim() || null,
        requesterId: userContext.userId,
        status: DocumentStatus.DRAFT,
        deleteYn: 'N',
        createdBy: userContext.userId,
      }),
    );
  }

  async update(
    userContext: UserContext,
    requestId: string,
    dto: UpdatePurchaseRequestDto,
  ) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      requestId,
    );
    assertDraft(document.status);

    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo.trim();
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.typeCode !== undefined)
      document.typeCode = dto.typeCode?.trim() || null;
    if (dto.requiredDate !== undefined)
      document.requiredDate = dto.requiredDate?.trim() || null;
    if (dto.content !== undefined)
      document.content = dto.content?.trim() || null;
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return this.repository.save(document);
  }

  async remove(userContext: UserContext, requestId: string) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      requestId,
    );
    assertDraft(document.status);
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return this.repository.save(document);
  }

  private async findActiveOrThrow(companyId: string, requestId: string) {
    const document = await this.repository.findOneBy({
      companyId,
      requestId,
      deleteYn: 'N',
    });
    if (!document) {
      throw new NotFoundException('Purchase request not found');
    }
    return document;
  }
}
