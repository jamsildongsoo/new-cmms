import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseResponseDto } from './dto/warehouse-response.dto';
import { Warehouse } from './entities/warehouse.entity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
  ) {}

  async findAll(userContext: UserContext): Promise<WarehouseResponseDto[]> {
    const warehouses = await this.warehouseRepository.find({
      where: { companyId: userContext.companyId, deleteYn: 'N' },
      order: { warehouseId: 'ASC' },
    });
    return warehouses.map((warehouse) => this.toResponse(warehouse));
  }

  async findOne(
    userContext: UserContext,
    warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(userContext.companyId, warehouseId),
    );
  }

  async create(
    userContext: UserContext,
    dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouseId = this.requireTrimmedString(
      dto.warehouseId,
      'warehouseId',
    );
    const existingWarehouse = await this.warehouseRepository.findOneBy({
      companyId: userContext.companyId,
      warehouseId,
    });

    if (existingWarehouse) {
      throw new ConflictException('Warehouse already exists');
    }

    const warehouse = this.warehouseRepository.create({
      companyId: userContext.companyId,
      warehouseId,
      siteId: this.normalizeNullableString(dto.siteId),
      name: this.requireTrimmedString(dto.name, 'name'),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.warehouseRepository.save(warehouse));
  }

  async update(
    userContext: UserContext,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.findActiveByIdOrThrow(
      userContext.companyId,
      warehouseId,
    );

    if (dto.siteId !== undefined) {
      warehouse.siteId = this.normalizeNullableString(dto.siteId);
    }
    if (dto.name !== undefined) {
      warehouse.name = this.requireTrimmedString(dto.name, 'name');
    }

    warehouse.updatedBy = userContext.userId;
    warehouse.updatedAt = new Date();

    return this.toResponse(await this.warehouseRepository.save(warehouse));
  }

  async remove(
    userContext: UserContext,
    warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.findActiveByIdOrThrow(
      userContext.companyId,
      warehouseId,
    );
    warehouse.deleteYn = 'Y';
    warehouse.updatedBy = userContext.userId;
    warehouse.updatedAt = new Date();
    return this.toResponse(await this.warehouseRepository.save(warehouse));
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    warehouseId: string,
  ): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOneBy({
      companyId,
      warehouseId: this.requireTrimmedString(warehouseId, 'warehouseId'),
      deleteYn: 'N',
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    return warehouse;
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

  private toResponse(warehouse: Warehouse): WarehouseResponseDto {
    return {
      companyId: warehouse.companyId,
      warehouseId: warehouse.warehouseId,
      siteId: warehouse.siteId,
      name: warehouse.name,
      deleteYn: warehouse.deleteYn,
      createdBy: warehouse.createdBy,
      createdAt: warehouse.createdAt,
      updatedBy: warehouse.updatedBy,
      updatedAt: warehouse.updatedAt,
    };
  }
}
