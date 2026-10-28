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
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrder } from './entities/purchase-order.entity';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly repository: Repository<PurchaseOrder>,
  ) {}

  findAll(userContext: UserContext) {
    return this.repository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userContext: UserContext, orderId: string) {
    return this.findActiveOrThrow(userContext.companyId, orderId);
  }

  async create(userContext: UserContext, dto: CreatePurchaseOrderDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      orderId: dto.orderId,
    });
    if (existing) {
      throw new ConflictException('Purchase order already exists');
    }

    return this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        orderId: dto.orderId,
        documentNo: dto.documentNo.trim(),
        title: dto.title.trim(),
        typeCode: dto.typeCode?.trim() || null,
        expectedDeliveryDate: dto.expectedDeliveryDate?.trim() || null,
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
    orderId: string,
    dto: UpdatePurchaseOrderDto,
  ) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      orderId,
    );
    assertDraft(document.status);

    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo.trim();
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.typeCode !== undefined)
      document.typeCode = dto.typeCode?.trim() || null;
    if (dto.expectedDeliveryDate !== undefined)
      document.expectedDeliveryDate = dto.expectedDeliveryDate?.trim() || null;
    if (dto.content !== undefined)
      document.content = dto.content?.trim() || null;
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return this.repository.save(document);
  }

  async remove(userContext: UserContext, orderId: string) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      orderId,
    );
    assertDraft(document.status);
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return this.repository.save(document);
  }

  private async findActiveOrThrow(companyId: string, orderId: string) {
    const document = await this.repository.findOneBy({
      companyId,
      orderId,
      deleteYn: 'N',
    });
    if (!document) {
      throw new NotFoundException('Purchase order not found');
    }
    return document;
  }
}
