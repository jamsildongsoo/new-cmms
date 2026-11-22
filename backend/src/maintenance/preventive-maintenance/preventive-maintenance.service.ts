import { businessDate } from '../../common/utils/date.util';
import { SearchPreventiveMaintenanceDto } from './dto/search-preventive-maintenance.dto';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import type { EntityManager } from 'typeorm';
/** 회사·사업장·부서 범위의 PM과 작성자 초안을 관리하고 결재 완결 시 저장된 점검 날짜를 설비에 반영한다. */
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
import { CodeGroup } from '../../common/constants/code';
import { nextInspectionDate } from './inspection-date.util';
import { InspectionItemDto } from './dto/inspection-item.dto';
import { Equipment } from '../equipment/entities/equipment.entity';
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenance } from './entities/preventive-maintenance.entity';

@Injectable()
export class PreventiveMaintenanceService {
  private readonly logger = new Logger(PreventiveMaintenanceService.name);
  withManager(manager: EntityManager): PreventiveMaintenanceService {
    return new PreventiveMaintenanceService(
      manager.getRepository(PreventiveMaintenance),
      manager.getRepository(Equipment),
    );
  }

  constructor(
    @InjectRepository(PreventiveMaintenance)
    private readonly repository: Repository<PreventiveMaintenance>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
  ) {}

  private scoped(user: UserContext) {
    // 이 모듈의 조회 정책이다. 기본 조건 뒤에는 andWhere로 업무 조건을 추가한다.
    const query = this.repository.createQueryBuilder('pm');
    query
      .where('pm.companyId = :companyId', { companyId: user.companyId })
      .andWhere('pm.deleteYn = :deleteYn', { deleteYn: 'N' });
    if (user.accessScope === 'COMPANY_ALL') return query;
    if (user.accessScope === 'OWN_SITE' && user.siteId)
      return query.andWhere('pm.siteId = :scopeSiteId', {
        scopeSiteId: user.siteId,
      });
    if (user.accessScope === 'OWN_DEPARTMENT' && user.deptId)
      return query.andWhere(
        `pm.deptId IN (
        WITH RECURSIVE scope_departments AS (
          SELECT "deptId" FROM "department" WHERE "companyId" = :companyId AND "deptId" = :scopeDeptId AND "deleteYn" = 'N'
          UNION
          SELECT d."deptId" FROM "department" d JOIN scope_departments p ON d."parentDeptId" = p."deptId"
          WHERE d."companyId" = :companyId AND d."deleteYn" = 'N'
        ) SELECT "deptId" FROM scope_departments
      )`,
        { scopeDeptId: user.deptId },
      );
    throw new ForbiddenException(
      'Document access scope or affiliation is missing',
    );
  }

  async getOptions(userContext: UserContext) {
    this.scoped(userContext);
    const companyId = userContext.companyId;
    const [equipment, types, departments, users] = await Promise.all([
      this.equipmentRepository.find({
        where: { companyId, deleteYn: 'N' },
        order: { equipmentId: 'ASC' },
      }),
      this.repository.manager.getRepository(CodeItem).find({
        where: { companyId, codeId: CodeGroup.PMAINT_TYPE },
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
    const units = await this.repository.manager.getRepository(CodeItem).find({
      where: { companyId: companyId, codeId: CodeGroup.UNIT },
      order: { sortOrder: 'ASC', codeItemId: 'ASC' },
    });
    return {
      // 프런트의 해당 업무 Options.units와 함께 수정한다. UNIT 항목은 DB에서 조회한다.
      units: units.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
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

  async findAll(
    user: UserContext,
    filter: SearchPreventiveMaintenanceDto = {},
  ) {
    const { page, limit, offset } = normalizePaginationQuery(filter);
    const query = this.scoped(user).select([
      'pm.companyId',
      'pm.pmId',
      'pm.documentNo',
      'pm.title',
      'pm.equipmentId',
      'pm.inspectionDate',
      'pm.nextInspectionDate',
      'pm.result',
      'pm.deptId',
      'pm.inspectorId',
      'pm.status',
    ]);
    if (filter.search?.trim())
      query.andWhere(
        '(pm.pmId ILIKE :search OR pm.documentNo ILIKE :search OR pm.title ILIKE :search OR pm.equipmentId ILIKE :search)',
        { search: `%${filter.search.trim().replace(/[\\%_]/g, '\\$&')}%` },
      );
    const [rows, total] = await query
      .orderBy('pm.createdAt', 'DESC')
      .addOrderBy('pm.pmId', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    const items = (await this.responses(rows)).map(
      ({
        pmId,
        documentNo,
        title,
        equipmentId,
        inspectionDate,
        nextInspectionDate,
        result,
        deptId,
        deptName,
        inspectorId,
        inspectorName,
        status,
      }) => ({
        pmId,
        documentNo,
        title,
        equipmentId,
        inspectionDate,
        nextInspectionDate,
        result,
        deptId,
        deptName,
        inspectorId,
        inspectorName,
        status,
      }),
    );
    return { items, total, page, limit };
  }

  async findOne(user: UserContext, pmId: string) {
    return (await this.responses([await this.findAccessible(user, pmId)]))[0];
  }

  private async findAccessible(user: UserContext, pmId: string) {
    const document = await this.scoped(user)
      .andWhere('pm.pmId = :id', { id: pmId })
      .getOne();
    if (!document)
      throw new NotFoundException('Preventive maintenance not found');
    return document;
  }

  // 저장된 ID는 유지하고 표시 이름은 같은 회사의 활성 기준정보에서만 조회한다.
  private async responses(rows: PreventiveMaintenance[]) {
    if (!rows.length) return [];
    const companyId = rows[0].companyId;
    const deptIds = [
      ...new Set(
        rows.map((r) => r.deptId).filter((id): id is string => Boolean(id)),
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
            .find({ where: { companyId, deptId: In(deptIds), deleteYn: 'N' } })
        : Promise.resolve([]),
      userIds.length
        ? this.repository.manager
            .getRepository(User)
            .find({ where: { companyId, userId: In(userIds), deleteYn: 'N' } })
        : Promise.resolve([]),
    ]);
    return rows.map((row) =>
      Object.assign({}, row, {
        result: row.result ?? null,
        deptId: row.deptId ?? null,
        inspectorId: row.inspectorId ?? null,
        deptName:
          departments.find((d) => d.deptId === row.deptId)?.name ?? null,
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
    const deptId =
      dto.deptId === undefined
        ? userContext.deptId || null
        : dto.deptId?.trim() || null;
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
        inspectionDate: this.requireInspectionDate(dto.inspectionDate),
        nextInspectionDate: this.resolveNextDate(
          equipment,
          businessDate(
            dto.inspectionDate?.trim() === '' ? null : dto.inspectionDate,
            true,
            'inspectionDate',
          ),
          dto.nextInspectionDate,
        ),
        items: this.normalizeItems(dto.items ?? []),
        typeCode: dto.typeCode?.trim() || null,
        result: this.normalizeResult(dto.result),
        siteId: userContext.siteId ?? null,
        deptId,
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
    const document = await this.findAccessible(userContext, pmId);
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
      document.inspectionDate = this.requireInspectionDate(dto.inspectionDate);
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
    if (dto.deptId !== undefined) {
      const deptId = dto.deptId?.trim() || null;
      document.deptId = deptId;
    }
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
    const document = await this.findAccessible(userContext, pmId);
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
    const row = await this.findAccessible(user, id);
    assertDraft(row.status);
    if (row.createdBy !== user.userId)
      throw new ForbiddenException('Only the owner can submit this document');
    this.requireInspectionDate(row.inspectionDate);
    if (!row.result || !row.deptId?.trim() || !row.inspectorId?.trim())
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

  private requireInspectionDate(value: string | null | undefined): string {
    const date = businessDate(
      value?.trim() === '' ? null : value,
      true,
      'inspectionDate',
    );
    if (!date) throw new BadRequestException('점검일을 입력해 주세요.');
    return date;
  }

  /** 사용자가 지정한 다음 점검일을 우선한다. 값이 생략된 경우에만 설비 주기로 다음 날짜를 제안한다. */
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
      : businessDate(
          requested?.trim() === '' ? null : requested,
          true,
          'nextInspectionDate',
        );
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
