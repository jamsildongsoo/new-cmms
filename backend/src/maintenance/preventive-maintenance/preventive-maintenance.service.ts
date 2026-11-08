/** 회사별 PM과 작성자 초안을 관리하고 결재 완결 시 저장된 점검 날짜를 설비에 반영한다. */
import {
  BadRequestException,
  Logger,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Department } from '../../organization/departments/entities/department.entity';
import { User } from '../../identity/users/entities/user.entity';
import { UserContext } from '../../auth/types/user-context.type';
import { DocumentStatus } from '../../common/constants/document-status';
import { assertDraft } from '../../common/utils/document-status.util';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { Code } from '../../common/constants/code';
import { inspectionDate, nextInspectionDate } from './inspection-date.util';
import { InspectionItemDto } from './dto/inspection-item.dto';
import { Equipment } from '../equipment/entities/equipment.entity';
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenance } from './entities/preventive-maintenance.entity';

@Injectable()
export class PreventiveMaintenanceService {
  private readonly logger = new Logger(PreventiveMaintenanceService.name);
  constructor(
    @InjectRepository(PreventiveMaintenance)
    private readonly repository: Repository<PreventiveMaintenance>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}

  async getOptions(userContext: UserContext) {
    const companyId = userContext.companyId;
    const [equipment, types, departments, users] = await Promise.all([
      this.equipmentRepository.find({
        where: { companyId, deleteYn: 'N' },
        order: { equipmentId: 'ASC' },
      }),
      this.repository.manager.getRepository(CodeItem).find({
        where: { companyId, codeId: Code.PREVENTIVE_MAINTENANCE_TYPE },
        order: { sortOrder: 'ASC', codeItemId: 'ASC' },
      }),
      this.repository.manager.getRepository(Department).find({
        where: { companyId, deleteYn: 'N' },
        order: { deptId: 'ASC' },
      }),
      this.repository.manager.getRepository(User).find({
        where: { companyId, deleteYn: 'N' },
        order: { userId: 'ASC' },
      }),
    ]);
    return {
      departments: departments.map(({ deptId, name }) => ({
        value: deptId,
        label: name,
      })),
      users: users.map(({ userId, name }) => ({ value: userId, label: name })),
      equipment: equipment.map(
        ({ equipmentId, name, inspectionPeriod, inspectionUnit }) => ({
          equipmentId,
          name,
          inspectionPeriod,
          inspectionUnit,
        }),
      ),
      types: types.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
    };
  }

  async findAll(userContext: UserContext) {
    return this.responses(
      await this.repository.find({
        where: { companyId: userContext.companyId, deleteYn: 'N' },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async findOne(userContext: UserContext, pmId: string) {
    return (
      await this.responses([
        await this.findActiveOrThrow(userContext.companyId, pmId),
      ])
    )[0];
  }

  // 기준정보가 삭제돼도 과거 점검 기록과 이름 조회는 유지한다.
  private async responses(rows: PreventiveMaintenance[]) {
    if (!rows.length) return [];
    const companyId = rows[0].companyId;
    const deptIds = [
      ...new Set(
        rows
          .map((r) => r.inspectionDeptId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const userIds = [
      ...new Set(
        rows
          .map((r) => r.inspectorId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [departments, users] = await Promise.all([
      deptIds.length
        ? this.repository.manager
            .getRepository(Department)
            .find({ where: { companyId, deptId: In(deptIds) } })
        : Promise.resolve([]),
      userIds.length
        ? this.repository.manager
            .getRepository(User)
            .find({ where: { companyId, userId: In(userIds) } })
        : Promise.resolve([]),
    ]);
    return rows.map((row) =>
      Object.assign({}, row, {
        result: row.result ?? null,
        inspectionDeptId: row.inspectionDeptId ?? null,
        inspectorId: row.inspectorId ?? null,
        inspectionDeptName:
          departments.find((d) => d.deptId === row.inspectionDeptId)?.name ??
          null,
        inspectorName:
          users.find((u) => u.userId === row.inspectorId)?.name ?? null,
      }),
    );
  }

  private normalizeResult(value: 'OK' | 'NOK' | null | undefined) {
    if (value == null) return null;
    if (value !== 'OK' && value !== 'NOK')
      throw new BadRequestException('판정은 OK/NOK를 선택하십시오.');
    return value;
  }

  async create(userContext: UserContext, dto: CreatePreventiveMaintenanceDto) {
    const existing = await this.repository.findOneBy({
      companyId: userContext.companyId,
      pmId: dto.pmId,
    });
    if (existing) {
      throw new ConflictException('Preventive maintenance already exists');
    }
    const equipment = await this.assertEquipmentExists(
      userContext.companyId,
      dto.equipmentId,
    );

    const saved = await this.repository.save(
      this.repository.create({
        companyId: userContext.companyId,
        pmId: dto.pmId,
        documentNo: dto.documentNo?.trim() ?? '',
        title: this.requireString(dto.title, 'title'),
        equipmentId: this.requireString(dto.equipmentId, 'equipmentId'),
        inspectionDate: inspectionDate(dto.inspectionDate, 'inspectionDate'),
        nextInspectionDate: this.resolveNextDate(
          equipment,
          inspectionDate(dto.inspectionDate, 'inspectionDate'),
          dto.nextInspectionDate,
        ),
        items: this.normalizeItems(dto.items ?? []),
        typeCode: dto.typeCode?.trim() || null,
        result: this.normalizeResult(dto.result),
        inspectionDeptId: dto.inspectionDeptId?.trim() || null,
        inspectorId: dto.inspectorId?.trim() || null,
        content: dto.content?.trim() || null,
        requesterId: userContext.userId,
        status: DocumentStatus.DRAFT,
        note: dto.note?.trim() || null,
        attachmentId: dto.attachmentId?.trim() || null,
        deleteYn: 'N',
        createdBy: userContext.userId,
      }),
    );
    return (await this.responses([saved]))[0];
  }

  async update(
    userContext: UserContext,
    pmId: string,
    dto: UpdatePreventiveMaintenanceDto,
  ) {
    const document = await this.findActiveOrThrow(userContext.companyId, pmId);
    assertDraft(document.status);
    if (document.createdBy !== userContext.userId) {
      throw new ForbiddenException('Only the owner can change this document');
    }

    const requestedEquipmentId =
      dto.equipmentId !== undefined
        ? this.requireString(dto.equipmentId, 'equipmentId')
        : document.equipmentId;
    const equipmentChanged = requestedEquipmentId !== document.equipmentId;
    const equipment = await this.assertEquipmentExists(
      userContext.companyId,
      requestedEquipmentId,
    );
    if (dto.equipmentId !== undefined)
      document.equipmentId = requestedEquipmentId;
    if (dto.documentNo !== undefined)
      document.documentNo = dto.documentNo?.trim() ?? '';
    if (dto.title !== undefined)
      document.title = this.requireString(dto.title, 'title');
    const dateChanged =
      dto.inspectionDate !== undefined &&
      dto.inspectionDate !== document.inspectionDate;
    if (dto.inspectionDate !== undefined)
      document.inspectionDate = inspectionDate(
        dto.inspectionDate,
        'inspectionDate',
      );
    const requestedNext =
      dto.nextInspectionDate !== undefined
        ? dto.nextInspectionDate
        : equipmentChanged || dateChanged
          ? undefined
          : document.nextInspectionDate;
    document.nextInspectionDate = this.resolveNextDate(
      equipment,
      document.inspectionDate,
      requestedNext,
    );
    if (dto.items !== undefined)
      document.items = this.normalizeItems(dto.items ?? []);
    if (dto.result !== undefined)
      document.result = this.normalizeResult(dto.result);
    if (dto.inspectionDeptId !== undefined)
      document.inspectionDeptId = dto.inspectionDeptId?.trim() || null;
    if (dto.inspectorId !== undefined)
      document.inspectorId = dto.inspectorId?.trim() || null;
    if (dto.typeCode !== undefined) {
      document.typeCode = dto.typeCode?.trim() || null;
    }
    if (dto.content !== undefined) {
      document.content = dto.content?.trim() || null;
    }
    if (dto.attachmentId !== undefined)
      document.attachmentId = dto.attachmentId?.trim() || null;
    if (dto.note !== undefined) document.note = dto.note?.trim() || null;
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();

    return (await this.responses([await this.repository.save(document)]))[0];
  }

  async remove(userContext: UserContext, pmId: string) {
    const document = await this.findActiveOrThrow(userContext.companyId, pmId);
    assertDraft(document.status);
    if (document.createdBy !== userContext.userId) {
      throw new ForbiddenException('Only the owner can change this document');
    }
    document.deleteYn = 'Y';
    document.updatedBy = userContext.userId;
    document.updatedAt = new Date();
    return (await this.responses([await this.repository.save(document)]))[0];
  }

  async assertCanSubmit(user: UserContext, id: string) {
    const row = await this.findActiveOrThrow(user.companyId, id);
    assertDraft(row.status);
    if (row.createdBy !== user.userId)
      throw new ForbiddenException('Only the owner can submit this document');
    if (
      !row.result ||
      !row.inspectionDeptId?.trim() ||
      !row.inspectorId?.trim()
    )
      throw new BadRequestException(
        '판정·점검부서·점검자를 입력한 뒤 상신하십시오.',
      );
  }

  /** 결재 → PM → 설비 순서로 확정한다. 후속 실패 시 앞서 저장한 결과는 롤백하지 않는다. */
  async syncApprovalStatus(
    companyId: string,
    pmId: string,
    status: DocumentStatus,
    updatedBy: string,
  ) {
    const document = await this.findActiveOrThrow(companyId, pmId);
    document.status = status;
    document.updatedBy = updatedBy;
    document.updatedAt = new Date();
    await this.repository.save(document);
    if (status !== DocumentStatus.CONFIRMED) return;
    try {
      // 결재 본문이나 현재 설비 주기로 재계산하지 않고 PM에 확정된 날짜를 그대로 반영한다.
      const result = await this.equipmentRepository.update(
        { companyId, equipmentId: document.equipmentId, deleteYn: 'N' },
        {
          inspectionDate: document.inspectionDate,
          nextInspectionDate: document.nextInspectionDate,
          updatedBy,
          updatedAt: new Date(),
        },
      );
      if (result.affected === 0)
        throw new NotFoundException('Equipment not found');
    } catch (error) {
      this.logger.error({
        message:
          'Equipment inspection update failed; approval and PM results are retained',
        companyId,
        pmId,
        equipmentId: document.equipmentId,
        stage: 'syncEquipmentInspectionDates',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private resolveNextDate(
    equipment: Equipment,
    date: string | null,
    requested: string | null | undefined,
  ) {
    if (!date || !equipment.inspectionPeriod || !equipment.inspectionUnit)
      return null;
    return requested === undefined
      ? nextInspectionDate(
          date,
          equipment.inspectionPeriod,
          equipment.inspectionUnit,
        )
      : inspectionDate(requested, 'nextInspectionDate');
  }

  private requireString(value: string | undefined, field: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${field} is required`);
    return value.trim();
  }

  private normalizeItems(items: InspectionItemDto[]) {
    return items.map((item) => {
      if (!item.name?.trim())
        throw new BadRequestException('Inspection item name is required');
      return {
        name: item.name.trim(),
        standardValue: item.standardValue?.trim() ?? '',
        inspectionValue: item.inspectionValue?.trim() ?? '',
        unit: item.unit?.trim() ?? '',
      };
    });
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
      equipmentId: this.requireString(equipmentId, 'equipmentId'),
      deleteYn: 'N',
    });
    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }
    return equipment;
  }
}
