import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeValidationService } from '../../codes/code-validation.service';
import { Code } from '../../common/constants/code';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { Department } from '../../organization/departments/entities/department.entity';
import { Site } from '../../organization/sites/entities/site.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { EquipmentResponseDto } from './dto/equipment-response.dto';
import {
  EquipmentSearchType,
  SearchEquipmentDto,
} from './dto/search-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { Equipment } from './entities/equipment.entity';

const EQUIPMENT_SEARCH_TYPES = ['equipmentId', 'name', 'typeCode'] as const;

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(Site)
    private readonly siteRepository: Repository<Site>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly codeValidationService: CodeValidationService,
  ) {}

  async findAll(
    userContext: UserContext,
    query: SearchEquipmentDto,
  ): Promise<PaginatedResponseDto<EquipmentResponseDto>> {
    const pagination = normalizePaginationQuery(query);
    const search = this.normalizeSearch(query);
    const queryBuilder = this.equipmentRepository
      .createQueryBuilder('equipment')
      .where('equipment.companyId = :companyId', {
        companyId: userContext.companyId,
      })
      .andWhere('equipment.deleteYn = :deleteYn', { deleteYn: 'N' })
      .orderBy('equipment.equipmentId', 'ASC')
      .skip(pagination.offset)
      .take(pagination.limit);

    if (search) {
      if (search.searchType === 'typeCode') {
        queryBuilder.andWhere('equipment.typeCode = :typeCode', {
          typeCode: search.searchVal,
        });
      } else {
        queryBuilder.andWhere(
          `equipment.${search.searchType} ILIKE :searchVal`,
          {
            searchVal: `%${search.searchVal}%`,
          },
        );
      }
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((item) => this.toResponse(item)),
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }

  async findOne(
    userContext: UserContext,
    equipmentId: string,
  ): Promise<EquipmentResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, equipmentId),
    );
  }

  async create(
    userContext: UserContext,
    dto: CreateEquipmentDto,
  ): Promise<EquipmentResponseDto> {
    const equipmentId = this.requireTrimmedString(
      dto.equipmentId,
      'equipmentId',
    );
    const existingEquipment = await this.equipmentRepository.findOneBy({
      companyId: userContext.companyId,
      equipmentId,
    });

    if (existingEquipment) {
      throw new ConflictException('Equipment already exists');
    }

    const siteId = this.requireTrimmedString(dto.siteId, 'siteId');
    const deptId = this.requireTrimmedString(dto.deptId, 'deptId');
    const typeCode = this.requireTrimmedString(dto.typeCode, 'typeCode');

    await this.assertSiteExists(userContext.companyId, siteId);
    await this.assertDepartmentExists(userContext.companyId, deptId);
    await this.assertEquipmentTypeCode(userContext.companyId, typeCode);

    const equipment = this.equipmentRepository.create({
      companyId: userContext.companyId,
      siteId,
      equipmentId,
      name: this.requireTrimmedString(dto.name, 'name'),
      typeCode,
      location: this.normalizeNullableString(dto.location),
      maker: this.normalizeNullableString(dto.maker),
      model: this.normalizeNullableString(dto.model),
      spec: this.normalizeNullableString(dto.spec),
      serialNo: this.normalizeNullableString(dto.serialNo),
      installDate: this.normalizeDateOnly(dto.installDate),
      deptId,
      period: this.normalizeNullableInteger(dto.period, 'period'),
      unit: this.normalizeNullableString(dto.unit),
      legalInspectionPeriod: this.normalizeNullableInteger(
        dto.legalInspectionPeriod,
        'legalInspectionPeriod',
      ),
      legalInspectionUnit: this.normalizeNullableString(
        dto.legalInspectionUnit,
      ),
      attachmentId: this.normalizeNullableString(dto.attachmentId),
      note: this.normalizeNullableString(dto.note),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.equipmentRepository.save(equipment));
  }

  async update(
    userContext: UserContext,
    equipmentId: string,
    dto: UpdateEquipmentDto,
  ): Promise<EquipmentResponseDto> {
    const equipment = await this.findActiveByIdOrThrow(
      userContext.companyId,
      equipmentId,
    );

    if (dto.siteId !== undefined) {
      equipment.siteId = this.requireTrimmedString(dto.siteId, 'siteId');
      await this.assertSiteExists(userContext.companyId, equipment.siteId);
    }
    if (dto.deptId !== undefined) {
      equipment.deptId = this.requireTrimmedString(dto.deptId, 'deptId');
      await this.assertDepartmentExists(
        userContext.companyId,
        equipment.deptId,
      );
    }
    if (dto.typeCode !== undefined) {
      equipment.typeCode = this.requireTrimmedString(dto.typeCode, 'typeCode');
      await this.assertEquipmentTypeCode(
        userContext.companyId,
        equipment.typeCode,
      );
    }
    if (dto.name !== undefined) {
      equipment.name = this.requireTrimmedString(dto.name, 'name');
    }
    if (dto.location !== undefined) {
      equipment.location = this.normalizeNullableString(dto.location);
    }
    if (dto.maker !== undefined) {
      equipment.maker = this.normalizeNullableString(dto.maker);
    }
    if (dto.model !== undefined) {
      equipment.model = this.normalizeNullableString(dto.model);
    }
    if (dto.spec !== undefined) {
      equipment.spec = this.normalizeNullableString(dto.spec);
    }
    if (dto.serialNo !== undefined) {
      equipment.serialNo = this.normalizeNullableString(dto.serialNo);
    }
    if (dto.installDate !== undefined) {
      equipment.installDate = this.normalizeDateOnly(dto.installDate);
    }
    if (dto.period !== undefined) {
      equipment.period = this.normalizeNullableInteger(dto.period, 'period');
    }
    if (dto.unit !== undefined) {
      equipment.unit = this.normalizeNullableString(dto.unit);
    }
    if (dto.legalInspectionPeriod !== undefined) {
      equipment.legalInspectionPeriod = this.normalizeNullableInteger(
        dto.legalInspectionPeriod,
        'legalInspectionPeriod',
      );
    }
    if (dto.legalInspectionUnit !== undefined) {
      equipment.legalInspectionUnit = this.normalizeNullableString(
        dto.legalInspectionUnit,
      );
    }
    if (dto.attachmentId !== undefined) {
      equipment.attachmentId = this.normalizeNullableString(dto.attachmentId);
    }
    if (dto.note !== undefined) {
      equipment.note = this.normalizeNullableString(dto.note);
    }

    equipment.updatedBy = userContext.userId;
    equipment.updatedAt = new Date();

    return this.toResponse(await this.equipmentRepository.save(equipment));
  }

  async remove(
    userContext: UserContext,
    equipmentId: string,
  ): Promise<EquipmentResponseDto> {
    const equipment = await this.findActiveByIdOrThrow(
      userContext.companyId,
      equipmentId,
    );

    equipment.deleteYn = 'Y';
    equipment.updatedBy = userContext.userId;
    equipment.updatedAt = new Date();

    return this.toResponse(await this.equipmentRepository.save(equipment));
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    equipmentId: string,
  ): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOneBy({
      companyId,
      equipmentId: this.requireTrimmedString(equipmentId, 'equipmentId'),
      deleteYn: 'N',
    });

    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    return equipment;
  }

  private async assertSiteExists(
    companyId: string,
    siteId: string,
  ): Promise<void> {
    const site = await this.siteRepository.findOneBy({
      companyId,
      siteId,
      deleteYn: 'N',
    });

    if (!site) {
      throw new BadRequestException('siteId is invalid');
    }
  }

  private async assertDepartmentExists(
    companyId: string,
    deptId: string,
  ): Promise<void> {
    const department = await this.departmentRepository.findOneBy({
      companyId,
      deptId,
      deleteYn: 'N',
    });

    if (!department) {
      throw new BadRequestException('deptId is invalid');
    }
  }

  private assertEquipmentTypeCode(
    companyId: string,
    typeCode: string,
  ): Promise<void> {
    return this.codeValidationService.assertValidItem({
      companyId,
      codeId: Code.EQUIPMENT_TYPE,
      codeItemId: typeCode,
    });
  }

  private normalizeSearch(
    query: SearchEquipmentDto,
  ): { searchType: EquipmentSearchType; searchVal: string } | null {
    const searchType = query.searchType;
    const searchVal = this.normalizeNullableString(query.searchVal);

    if (!searchType && !searchVal) {
      return null;
    }
    if (!searchType || !searchVal) {
      throw new BadRequestException(
        'searchType and searchVal must be together',
      );
    }
    if (!EQUIPMENT_SEARCH_TYPES.includes(searchType)) {
      throw new BadRequestException('Invalid equipment searchType');
    }

    return { searchType, searchVal };
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

  private normalizeNullableString(
    value: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmedValue = value.trim();
    return trimmedValue === '' ? null : trimmedValue;
  }

  private normalizeNullableInteger(
    value: number | null | undefined,
    fieldName: string,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative integer`,
      );
    }
    return value;
  }

  private normalizeDateOnly(value: string | null | undefined): string | null {
    const normalizedValue = this.normalizeNullableString(value);
    if (normalizedValue === null) {
      return null;
    }
    if (!/^\d{8}$/.test(normalizedValue)) {
      throw new BadRequestException('installDate must be YYYYMMDD');
    }
    return normalizedValue;
  }

  private toResponse(equipment: Equipment): EquipmentResponseDto {
    return {
      companyId: equipment.companyId,
      siteId: equipment.siteId,
      equipmentId: equipment.equipmentId,
      name: equipment.name,
      typeCode: equipment.typeCode,
      location: equipment.location,
      maker: equipment.maker,
      model: equipment.model,
      spec: equipment.spec,
      serialNo: equipment.serialNo,
      installDate: equipment.installDate,
      deptId: equipment.deptId,
      period: equipment.period,
      unit: equipment.unit,
      legalInspectionPeriod: equipment.legalInspectionPeriod,
      legalInspectionUnit: equipment.legalInspectionUnit,
      attachmentId: equipment.attachmentId,
      note: equipment.note,
      deleteYn: equipment.deleteYn,
      createdBy: equipment.createdBy,
      createdAt: equipment.createdAt,
      updatedBy: equipment.updatedBy,
      updatedAt: equipment.updatedAt,
    };
  }
}
