import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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
      order: { siteId: 'ASC', warehouseId: 'ASC' },
    });
    return warehouses.map((warehouse) => this.toResponse(warehouse));
  }

  async findOne(
    userContext: UserContext,
    siteId: string,
    warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    return this.toResponse(
      await this.findActiveByIdOrThrow(
        userContext.companyId,
        siteId,
        warehouseId,
      ),
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
    const siteId = this.requireTrimmedString(dto.siteId, 'siteId');
    const existingWarehouse = await this.warehouseRepository.findOneBy({
      companyId: userContext.companyId,
      siteId,
      warehouseId,
    });

    if (existingWarehouse) {
      throw new ConflictException('Warehouse already exists');
    }

    const warehouse = this.warehouseRepository.create({
      companyId: userContext.companyId,
      siteId,
      warehouseId,
      name: this.requireTrimmedString(dto.name, 'name'),
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    try {
      return this.toResponse(await this.warehouseRepository.save(warehouse));
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      )
        throw new ConflictException('Warehouse already exists in this site');
      throw error;
    }
  }

  async update(
    userContext: UserContext,
    siteId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.findActiveByIdOrThrow(
      userContext.companyId,
      siteId,
      warehouseId,
    );

    if (dto.name !== undefined) {
      warehouse.name = this.requireTrimmedString(dto.name, 'name');
    }

    warehouse.updatedBy = userContext.userId;
    warehouse.updatedAt = new Date();

    return this.toResponse(await this.warehouseRepository.save(warehouse));
  }

  async remove(
    userContext: UserContext,
    siteId: string,
    warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    const warehouse = await this.findActiveByIdOrThrow(
      userContext.companyId,
      siteId,
      warehouseId,
    );
    warehouse.deleteYn = 'Y';
    warehouse.updatedBy = userContext.userId;
    warehouse.updatedAt = new Date();
    return this.toResponse(await this.warehouseRepository.save(warehouse));
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    siteId: string,
    warehouseId: string,
  ): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOneBy({
      companyId,
      siteId: this.requireTrimmedString(siteId, 'siteId'),
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
