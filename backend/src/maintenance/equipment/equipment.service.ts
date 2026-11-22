import { businessDate } from '../../common/utils/date.util';
/** 회사별 설비와 같은 사업장의 부모 계층을 관리하며 순환과 활성 하위 설비 삭제를 방지한다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { CodeValidationService } from '../../codes/code-validation.service';
import { CodeGroup } from '../../common/constants/code';
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

  // 설비 조회 권한만으로 입력에 필요한 동일 회사의 선택 목록을 제공한다.
  async getOptions(userContext: UserContext) {
    const companyId = userContext.companyId;
    const [sites, departments, types] = await Promise.all([
      this.siteRepository.find({
        where: { companyId, deleteYn: 'N' },
        order: { siteId: 'ASC' },
      }),
      this.departmentRepository.find({
        where: { companyId, deleteYn: 'N' },
        order: { deptId: 'ASC' },
      }),
      this.equipmentRepository.manager.getRepository(CodeItem).find({
        where: { companyId, codeId: CodeGroup.EQUIP_TYPE },
        order: { sortOrder: 'ASC', codeItemId: 'ASC' },
      }),
    ]);
    return {
      sites: sites.map(({ siteId, name }) => ({ value: siteId, label: name })),
      departments: departments.map(({ deptId, name }) => ({
        value: deptId,
        label: name,
      })),
      types: types.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
    };
  }

  // 목록 페이지 제한과 무관하게 같은 회사의 전체 트리 노드를 제공한다.
  async tree(
    user: UserContext,
    siteId?: string,
  ): Promise<EquipmentResponseDto[]> {
    const rows = await this.equipmentRepository.find({
      where: {
        companyId: user.companyId,
        deleteYn: 'N',
        ...(siteId ? { siteId } : {}),
      },
      order: { equipmentId: 'ASC' },
    });
    return rows.map((row) => this.toResponse(row));
  }

  private async assertNoChildren(companyId: string, equipmentId: string) {
    if (
      await this.equipmentRepository.findOneBy({
        companyId,
        parentEquipmentId: equipmentId,
        deleteYn: 'N',
      })
    )
      throw new ConflictException(
        '활성 하위 설비가 있어 삭제 또는 사업장 변경을 할 수 없습니다.',
      );
  }

  private async assertParent(
    companyId: string,
    equipmentId: string,
    siteId: string,
    parentEquipmentId: string | null,
  ) {
    if (!parentEquipmentId) return;
    if (parentEquipmentId === equipmentId)
      throw new BadRequestException(
        '자기 자신을 상위 설비로 지정할 수 없습니다.',
      );
    const rows = await this.equipmentRepository.find({
      where: { companyId, deleteYn: 'N' },
    });
    const byId = new Map(rows.map((row) => [row.equipmentId, row]));
    const visited = new Set<string>([equipmentId]);
    let current: string | null = parentEquipmentId;
    while (current) {
      if (visited.has(current))
        throw new BadRequestException('순환 설비 연결은 허용되지 않습니다.');
      visited.add(current);
      const parent = byId.get(current);
      if (!parent || parent.siteId !== siteId)
        throw new BadRequestException(
          '상위 설비는 동일 회사·사업장의 활성 설비여야 합니다.',
        );
      current = parent.parentEquipmentId ?? null;
    }
  }

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

    for (const field of ['siteId', 'deptId', 'parentEquipmentId'] as const)
      if (query[field]?.trim())
        queryBuilder.andWhere(`equipment.${field} = :${field}`, {
          [field]: query[field]!.trim(),
        });

    if (search) {
      if (search.searchType === 'typeCode') {
        queryBuilder.andWhere('equipment.typeCode = :typeCode', {
          typeCode: search.searchVal,
        });
      } else {
        queryBuilder.andWhere(
          `equipment.${search.searchType} ILIKE :searchVal`,
          {
            searchVal: `%${search.searchVal.replace(/[\\%_]/g, '\\$&')}%`,
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

    // 사업장·부서는 회사별 선택 목록으로 입력하고 기존 참조에 삭제를 소급하지 않는다.
    await this.assertEquipmentTypeCode(userContext.companyId, typeCode);

    const parentEquipmentId = this.normalizeNullableString(
      dto.parentEquipmentId,
    );
    await this.assertParent(
      userContext.companyId,
      equipmentId,
      siteId,
      parentEquipmentId,
    );
    const equipment = this.equipmentRepository.create({
      companyId: userContext.companyId,
      siteId,
      equipmentId,
      parentEquipmentId,
      pmTargetYn: this.normalizeFlag(dto.pmTargetYn ?? 'N'),
      permitTargetYn: this.normalizeFlag(dto.permitTargetYn ?? 'N'),
      legalInspectionDate: this.normalizeDateOnly(
        dto.legalInspectionDate,
        'legalInspectionDate',
      ),
      legalNextInspectionDate: this.normalizeDateOnly(
        dto.legalNextInspectionDate,
        'legalNextInspectionDate',
      ),
      name: this.requireTrimmedString(dto.name, 'name'),
      typeCode,
      location: this.normalizeNullableString(dto.location),
      maker: this.normalizeNullableString(dto.maker),
      model: this.normalizeNullableString(dto.model),
      spec: this.normalizeNullableString(dto.spec),
      serialNo: this.normalizeNullableString(dto.serialNo),
      installDate: this.normalizeDateOnly(dto.installDate),
      deptId,
      inspectionPeriod: this.normalizeNullableInteger(
        dto.inspectionPeriod,
        'inspectionPeriod',
      ),
      inspectionUnit: this.normalizeNullableString(dto.inspectionUnit),
      inspectionDate: this.normalizeDateOnly(
        dto.inspectionDate,
        'inspectionDate',
      ),
      nextInspectionDate: this.normalizeDateOnly(
        dto.nextInspectionDate,
        'nextInspectionDate',
      ),
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

    if (!equipment.inspectionPeriod || !equipment.inspectionUnit) {
      equipment.nextInspectionDate = null;
    }
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

    const nextSiteId =
      dto.siteId === undefined
        ? equipment.siteId
        : this.requireTrimmedString(dto.siteId, 'siteId');
    const nextParentId =
      dto.parentEquipmentId === undefined
        ? (equipment.parentEquipmentId ?? null)
        : this.normalizeNullableString(dto.parentEquipmentId);
    if (nextSiteId !== equipment.siteId)
      await this.assertNoChildren(userContext.companyId, equipmentId);
    await this.assertParent(
      userContext.companyId,
      equipmentId,
      nextSiteId,
      nextParentId,
    );
    equipment.parentEquipmentId = nextParentId;
    if (dto.pmTargetYn !== undefined)
      equipment.pmTargetYn = this.normalizeFlag(dto.pmTargetYn);
    if (dto.permitTargetYn !== undefined)
      equipment.permitTargetYn = this.normalizeFlag(dto.permitTargetYn);
    if (dto.legalInspectionDate !== undefined)
      equipment.legalInspectionDate = this.normalizeDateOnly(
        dto.legalInspectionDate,
        'legalInspectionDate',
      );
    if (dto.legalNextInspectionDate !== undefined)
      equipment.legalNextInspectionDate = this.normalizeDateOnly(
        dto.legalNextInspectionDate,
        'legalNextInspectionDate',
      );
    if (dto.siteId !== undefined) {
      equipment.siteId = this.requireTrimmedString(dto.siteId, 'siteId');
    }
    if (dto.deptId !== undefined) {
      equipment.deptId = this.requireTrimmedString(dto.deptId, 'deptId');
    }
    if (dto.typeCode !== undefined) {
      const typeCode = this.requireTrimmedString(dto.typeCode, 'typeCode');
      if (typeCode !== equipment.typeCode) {
        await this.assertEquipmentTypeCode(userContext.companyId, typeCode);
      }
      equipment.typeCode = typeCode;
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
    if (dto.inspectionPeriod !== undefined) {
      equipment.inspectionPeriod = this.normalizeNullableInteger(
        dto.inspectionPeriod,
        'inspectionPeriod',
      );
    }
    if (dto.inspectionUnit !== undefined) {
      equipment.inspectionUnit = this.normalizeNullableString(
        dto.inspectionUnit,
      );
    }
    if (dto.inspectionDate !== undefined) {
      equipment.inspectionDate = this.normalizeDateOnly(
        dto.inspectionDate,
        'inspectionDate',
      );
    }
    if (dto.nextInspectionDate !== undefined) {
      equipment.nextInspectionDate = this.normalizeDateOnly(
        dto.nextInspectionDate,
        'nextInspectionDate',
      );
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

    if (!equipment.inspectionPeriod || !equipment.inspectionUnit) {
      equipment.nextInspectionDate = null;
    }
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

    await this.assertNoChildren(userContext.companyId, equipmentId);
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

  private assertEquipmentTypeCode(
    companyId: string,
    typeCode: string,
  ): Promise<void> {
    return this.codeValidationService.assertValidItem({
      companyId,
      codeId: CodeGroup.EQUIP_TYPE,
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

  private normalizeFlag(value: string) {
    if (value !== 'Y' && value !== 'N')
      throw new BadRequestException('대상 여부는 Y/N이어야 합니다.');
    return value;
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

  private normalizeDateOnly(
    value: string | null | undefined,
    fieldName = 'installDate',
  ): string | null {
    const normalizedValue = this.normalizeNullableString(value);
    if (normalizedValue === null) {
      return null;
    }
    return businessDate(normalizedValue, false, fieldName);
  }

  private toResponse(equipment: Equipment): EquipmentResponseDto {
    return {
      companyId: equipment.companyId,
      siteId: equipment.siteId,
      equipmentId: equipment.equipmentId,
      parentEquipmentId: equipment.parentEquipmentId ?? null,
      pmTargetYn: equipment.pmTargetYn ?? 'N',
      permitTargetYn: equipment.permitTargetYn ?? 'N',
      legalInspectionDate: equipment.legalInspectionDate ?? null,
      legalNextInspectionDate: equipment.legalNextInspectionDate ?? null,
      name: equipment.name,
      typeCode: equipment.typeCode,
      location: equipment.location,
      maker: equipment.maker,
      model: equipment.model,
      spec: equipment.spec,
      serialNo: equipment.serialNo,
      installDate: equipment.installDate,
      deptId: equipment.deptId,
      inspectionPeriod: equipment.inspectionPeriod,
      inspectionUnit: equipment.inspectionUnit,
      inspectionDate: equipment.inspectionDate,
      nextInspectionDate: equipment.nextInspectionDate,
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
