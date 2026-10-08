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
import { Equipment } from '../equipment/entities/equipment.entity';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrder } from './entities/work-order.entity';

@Injectable()
export class WorkOrderService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}

  findAll(userContext: UserContext) {
    return this.repository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userContext: UserContext, workOrderId: string) {
    return this.findActiveOrThrow(userContext.companyId, workOrderId);
  }

  async create(userContext: UserContext, dto: CreateWorkOrderDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      workOrderId: dto.workOrderId,
    });
    if (existing) {
      throw new ConflictException('Work order already exists');
    }
    await this.assertEquipmentExists(userContext.companyId, dto.equipmentId);

    return this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        workOrderId: dto.workOrderId,
        documentNo: dto.documentNo.trim(),
        title: dto.title.trim(),
        equipmentId: dto.equipmentId.trim(),
        workDate: dto.workDate.trim(),
        typeCode: dto.typeCode?.trim() || null,
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
    workOrderId: string,
    dto: UpdateWorkOrderDto,
  ) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      workOrderId,
    );
    assertDraft(document.status);
    if (dto.equipmentId !== undefined) {
      await this.assertEquipmentExists(userContext.companyId, dto.equipmentId);
    }

    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo.trim();
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.equipmentId !== undefined)
      document.equipmentId = dto.equipmentId.trim();
    if (dto.workDate !== undefined) document.workDate = dto.workDate.trim();
    if (dto.typeCode !== undefined)
      document.typeCode = dto.typeCode?.trim() || null;
    if (dto.content !== undefined)
      document.content = dto.content?.trim() || null;
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return this.repository.save(document);
  }

  async remove(userContext: UserContext, workOrderId: string) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      workOrderId,
    );
    assertDraft(document.status);
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return this.repository.save(document);
  }

  private async findActiveOrThrow(companyId: string, workOrderId: string) {
    const document = await this.repository.findOneBy({
      companyId,
      workOrderId,
      deleteYn: 'N',
    });
    if (!document) {
      throw new NotFoundException('Work order not found');
    }
    return document;
  }

  private async assertEquipmentExists(companyId: string, equipmentId: string) {
    const equipment = await this.equipmentRepository.findOneBy({
      companyId,
      equipmentId: equipmentId.trim(),
      deleteYn: 'N',
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }
  }
}
