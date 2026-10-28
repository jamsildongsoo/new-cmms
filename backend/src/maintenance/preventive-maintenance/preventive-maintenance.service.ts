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
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenance } from './entities/preventive-maintenance.entity';

@Injectable()
export class PreventiveMaintenanceService {
  constructor(
    @InjectRepository(PreventiveMaintenance)
    private readonly repository: Repository<PreventiveMaintenance>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}

  findAll(userContext: UserContext) {
    return this.repository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userContext: UserContext, pmId: string) {
    return this.findActiveOrThrow(userContext.companyId, pmId);
  }

  async create(userContext: UserContext, dto: CreatePreventiveMaintenanceDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      pmId: dto.pmId,
    });
    if (existing) {
      throw new ConflictException('Preventive maintenance already exists');
    }
    await this.assertEquipmentExists(userContext.companyId, dto.equipmentId);

    return this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        pmId: dto.pmId,
        documentNo: dto.documentNo.trim(),
        title: dto.title.trim(),
        equipmentId: dto.equipmentId.trim(),
        plannedDate: dto.plannedDate ?? null,
        typeCode: dto.typeCode?.trim() || null,
        content: dto.content?.trim() || null,
        requesterId: userContext.userId,
        status: DocumentStatus.DRAFT,
        attachmentId: dto.attachmentId?.trim() || null,
        note: dto.note?.trim() || null,
        deleteYn: 'N',
        createdBy: userContext.userId,
      }),
    );
  }

  async update(
    userContext: UserContext,
    pmId: string,
    dto: UpdatePreventiveMaintenanceDto,
  ) {
    const document = await this.findActiveOrThrow(userContext.companyId, pmId);
    assertDraft(document.status);

    if (dto.equipmentId !== undefined) {
      await this.assertEquipmentExists(userContext.companyId, dto.equipmentId);
      document.equipmentId = dto.equipmentId.trim();
    }
    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo.trim();
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.plannedDate !== undefined) document.plannedDate = dto.plannedDate;
    if (dto.typeCode !== undefined) {
      document.typeCode = dto.typeCode?.trim() || null;
    }
    if (dto.content !== undefined) {
      document.content = dto.content?.trim() || null;
    }
    if (dto.attachmentId !== undefined) {
      document.attachmentId = dto.attachmentId?.trim() || null;
    }
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return this.repository.save(document);
  }

  async remove(userContext: UserContext, pmId: string) {
    const document = await this.findActiveOrThrow(userContext.companyId, pmId);
    assertDraft(document.status);
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return this.repository.save(document);
  }

  private async findActiveOrThrow(companyId: string, pmId: string) {
    const document = await this.repository.findOneBy({
      companyId,
      pmId,
      deleteYn: 'N',
    });
    if (!document) {
      throw new NotFoundException('Preventive maintenance not found');
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
