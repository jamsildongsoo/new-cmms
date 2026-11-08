/** 회사 공통 자재 마스터를 관리하고 거래 이력의 기본 단위와 문서 snapshot을 보존한다. */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CodeItem } from '../../codes/code-items/entities/code-item.entity';
import { CodeValidationService } from '../../codes/code-validation.service';
import { Code } from '../../common/constants/code';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { normalizePaginationQuery } from '../../common/utils/pagination.util';
import { Material } from './entities/material.entity';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { SearchMaterialDto } from './dto/search-material.dto';
import { MaterialResponseDto } from './dto/material-response.dto';

@Injectable()
export class MaterialService {
  constructor(
    @InjectRepository(Material)
    private readonly repository: Repository<Material>,
    private readonly codes: CodeValidationService,
  ) {}
  async getOptions(user: UserContext) {
    const types = await this.repository.manager.getRepository(CodeItem).find({
      where: { companyId: user.companyId, codeId: Code.MATERIAL_TYPE },
      order: { sortOrder: 'ASC', codeItemId: 'ASC' },
    });
    return {
      types: types.map(({ codeItemId, name }) => ({
        value: codeItemId,
        label: name,
      })),
    };
  }
  async findAll(
    user: UserContext,
    query: SearchMaterialDto,
  ): Promise<PaginatedResponseDto<MaterialResponseDto>> {
    const pagination = normalizePaginationQuery(query),
      value = query.searchVal?.trim();
    if (Boolean(query.searchType) !== Boolean(value))
      throw new BadRequestException('검색 기준과 검색어를 함께 입력하십시오.');
    const builder = this.repository
      .createQueryBuilder('material')
      .where('material.companyId = :companyId', { companyId: user.companyId })
      .andWhere('material.deleteYn = :deleteYn', { deleteYn: 'N' })
      .orderBy('material.materialId', 'ASC')
      .skip(pagination.offset)
      .take(pagination.limit);
    if (query.searchType && value) {
      // 검색 컬럼은 DTO 외에도 서비스에서 제한하여 SQL 식에 임의 값이 들어가지 않게 한다.
      if (!['materialId', 'name', 'typeCode'].includes(query.searchType))
        throw new BadRequestException('잘못된 검색 기준입니다.');
      if (query.searchType === 'typeCode')
        builder.andWhere('material.typeCode = :searchVal', {
          searchVal: value,
        });
      else
        builder.andWhere(`material.${query.searchType} ILIKE :searchVal`, {
          searchVal: `%${value}%`,
        });
    }
    const [items, total] = await builder.getManyAndCount();
    return {
      items: items.map((row) => this.toResponse(row)),
      page: pagination.page,
      limit: pagination.limit,
      total,
    };
  }
  async findOne(user: UserContext, id: string) {
    return this.toResponse(await this.active(user.companyId, id));
  }
  async create(user: UserContext, dto: CreateMaterialDto) {
    const materialId = this.required(dto.materialId, '자재번호');
    // 논리 삭제된 번호도 재사용하지 않아 기존 문서의 자재 참조를 보존한다.
    if (
      await this.repository.findOneBy({ companyId: user.companyId, materialId })
    )
      throw new ConflictException('이미 등록된 자재번호입니다.');
    const typeCode = this.required(dto.typeCode, '자재 유형');
    await this.assertType(user.companyId, typeCode);
    const row = this.repository.create({
      companyId: user.companyId,
      materialId,
      name: this.required(dto.name, '자재명'),
      typeCode,
      baseUnit: this.required(dto.baseUnit, '기본 단위'),
      spec: this.optional(dto.spec),
      maker: this.optional(dto.maker),
      model: this.optional(dto.model),
      note: this.optional(dto.note),
      attachmentId: this.optional(dto.attachmentId),
      deleteYn: 'N',
      createdBy: user.userId,
    });
    try {
      return this.toResponse(await this.repository.save(row));
    } catch (error) {
      // 사전 중복 조회 이후 같은 번호가 등록되더라도 복합 PK로 최종 차단한다.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('이미 등록된 자재번호입니다.');
      throw error;
    }
  }
  async update(user: UserContext, id: string, dto: UpdateMaterialDto) {
    const row = await this.active(user.companyId, id);
    // 마스터는 owner/결재 상태 제한 없이 Controller의 수정 권한으로 관리한다.
    if (dto.name !== undefined) row.name = this.required(dto.name, '자재명');
    if (dto.baseUnit !== undefined) {
      const unit = this.required(dto.baseUnit, '기본 단위');
      if (unit !== row.baseUnit) {
        const [usage]: { used: boolean }[] =
          await this.repository.manager.query(
            `SELECT EXISTS (
          SELECT 1 FROM purchase_request_item i JOIN purchase_request h ON h."companyId"=i."companyId" AND h."requestId"=i."requestId" WHERE i."companyId"=$1 AND i."materialId"=$2 AND h.status <> 'D'
          UNION ALL SELECT 1 FROM purchase_order_item i JOIN purchase_order h ON h."companyId"=i."companyId" AND h."orderId"=i."orderId" WHERE i."companyId"=$1 AND i."materialId"=$2 AND h.status <> 'D'
          UNION ALL SELECT 1 FROM inventory_item i JOIN inventory_document h ON h."companyId"=i."companyId" AND h."inventoryDocumentId"=i."inventoryDocumentId" WHERE i."companyId"=$1 AND i."materialId"=$2 AND h.status='C'
        ) AS used`,
            [user.companyId, id],
          );
        if (usage.used)
          throw new ConflictException(
            '거래 이력이 있는 자재의 기본 단위는 변경할 수 없습니다.',
          );
      }
      row.baseUnit = unit;
    }
    if (dto.typeCode !== undefined) {
      const typeCode = this.required(dto.typeCode, '자재 유형');
      if (typeCode !== row.typeCode)
        await this.assertType(user.companyId, typeCode);
      row.typeCode = typeCode;
    }
    for (const key of [
      'spec',
      'maker',
      'model',
      'note',
      'attachmentId',
    ] as const)
      if (dto[key] !== undefined) row[key] = this.optional(dto[key]);
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.toResponse(await this.repository.save(row));
  }
  async remove(user: UserContext, id: string) {
    const row = await this.active(user.companyId, id);
    row.deleteYn = 'Y';
    row.updatedBy = user.userId;
    row.updatedAt = new Date();
    return this.toResponse(await this.repository.save(row));
  }
  private async active(companyId: string, id: string) {
    const row = await this.repository.findOneBy({
      companyId,
      materialId: this.required(id, '자재번호'),
      deleteYn: 'N',
    });
    if (!row) throw new NotFoundException('자재를 찾을 수 없습니다.');
    return row;
  }
  private assertType(companyId: string, typeCode: string) {
    return this.codes.assertValidItem({
      companyId,
      codeId: Code.MATERIAL_TYPE,
      codeItemId: typeCode,
    });
  }
  private required(value: string | undefined, label: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${label}을(를) 입력하십시오.`);
    return value.trim();
  }
  private optional(value: string | null | undefined) {
    return value?.trim() || null;
  }
  private toResponse(row: Material): MaterialResponseDto {
    return {
      companyId: row.companyId,
      materialId: row.materialId,
      name: row.name,
      typeCode: row.typeCode,
      baseUnit: row.baseUnit,
      spec: row.spec,
      maker: row.maker,
      model: row.model,
      note: row.note,
      attachmentId: row.attachmentId,
      deleteYn: row.deleteYn,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
