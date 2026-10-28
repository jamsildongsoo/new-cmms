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
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { UpdateWorkPermitDto } from './dto/update-work-permit.dto';
import { WorkPermit } from './entities/work-permit.entity';

@Injectable()
export class WorkPermitService {
  constructor(
    @InjectRepository(WorkPermit)
    private readonly repository: Repository<WorkPermit>,
  ) {}

  findAll(userContext: UserContext) {
    return this.repository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { createdAt: 'DESC' },
    });
  }

  findOne(userContext: UserContext, workPermitId: string) {
    return this.findActiveOrThrow(userContext.companyId, workPermitId);
  }

  async create(userContext: UserContext, dto: CreateWorkPermitDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      workPermitId: dto.workPermitId,
    });
    if (existing) {
      throw new ConflictException('Work permit already exists');
    }

    return this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        workPermitId: dto.workPermitId,
        documentNo: dto.documentNo.trim(),
        title: dto.title.trim(),
        workDate: dto.workDate.trim(),
        startTime: dto.startTime.trim(),
        endTime: dto.endTime.trim(),
        supervisor: dto.supervisor?.trim() || null,
        equipmentText: dto.equipmentText?.trim() || null,
        workSummary: dto.workSummary?.trim() || null,
        riskFactor: dto.riskFactor?.trim() || null,
        safetyAction: dto.safetyAction?.trim() || null,
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
    workPermitId: string,
    dto: UpdateWorkPermitDto,
  ) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      workPermitId,
    );
    assertDraft(document.status);

    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo.trim();
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.workDate !== undefined) document.workDate = dto.workDate.trim();
    if (dto.startTime !== undefined) document.startTime = dto.startTime.trim();
    if (dto.endTime !== undefined) document.endTime = dto.endTime.trim();
    if (dto.supervisor !== undefined)
      document.supervisor = dto.supervisor?.trim() || null;
    if (dto.equipmentText !== undefined)
      document.equipmentText = dto.equipmentText?.trim() || null;
    if (dto.workSummary !== undefined)
      document.workSummary = dto.workSummary?.trim() || null;
    if (dto.riskFactor !== undefined)
      document.riskFactor = dto.riskFactor?.trim() || null;
    if (dto.safetyAction !== undefined)
      document.safetyAction = dto.safetyAction?.trim() || null;
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return this.repository.save(document);
  }

  async remove(userContext: UserContext, workPermitId: string) {
    const document = await this.findActiveOrThrow(
      userContext.companyId,
      workPermitId,
    );
    assertDraft(document.status);
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return this.repository.save(document);
  }

  private async findActiveOrThrow(companyId: string, workPermitId: string) {
    const document = await this.repository.findOneBy({
      companyId,
      workPermitId,
      deleteYn: 'N',
    });
    if (!document) {
      throw new NotFoundException('Work permit not found');
    }
    return document;
  }
}
