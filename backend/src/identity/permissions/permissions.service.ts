import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionRepository.find({
      where: {
        deleteYn: 'N',
      },
      order: {
        module: 'ASC',
        action: 'ASC',
        permissionId: 'ASC',
      },
    });

    return permissions.map((permission) => this.toResponse(permission));
  }

  async findOne(permissionId: string): Promise<PermissionResponseDto> {
    const permission = await this.findActiveByIdOrThrow(permissionId);
    return this.toResponse(permission);
  }

  async create(
    userContext: UserContext,
    createPermissionDto: CreatePermissionDto,
  ): Promise<PermissionResponseDto> {
    const permissionId = this.requireTrimmedString(
      createPermissionDto.permissionId,
      'permissionId',
    );
    const module = this.requireTrimmedString(
      createPermissionDto.module,
      'module',
    );
    const action = this.requireTrimmedString(
      createPermissionDto.action,
      'action',
    );
    const name = this.requireTrimmedString(createPermissionDto.name, 'name');
    const existingPermission = await this.permissionRepository.findOneBy({
      permissionId,
    });

    if (existingPermission) {
      throw new ConflictException('Permission already exists');
    }

    const permission = this.permissionRepository.create({
      permissionId,
      module,
      action,
      name,
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.permissionRepository.save(permission));
  }

  async update(
    userContext: UserContext,
    permissionId: string,
    updatePermissionDto: UpdatePermissionDto,
  ): Promise<PermissionResponseDto> {
    const permission = await this.findActiveByIdOrThrow(permissionId);

    if (updatePermissionDto.module !== undefined) {
      permission.module = this.requireTrimmedString(
        updatePermissionDto.module,
        'module',
      );
    }
    if (updatePermissionDto.action !== undefined) {
      permission.action = this.requireTrimmedString(
        updatePermissionDto.action,
        'action',
      );
    }
    if (updatePermissionDto.name !== undefined) {
      permission.name = this.requireTrimmedString(
        updatePermissionDto.name,
        'name',
      );
    }

    permission.updatedBy = userContext.userId;
    permission.updatedAt = new Date();

    return this.toResponse(await this.permissionRepository.save(permission));
  }

  async remove(
    userContext: UserContext,
    permissionId: string,
  ): Promise<PermissionResponseDto> {
    const permission = await this.findActiveByIdOrThrow(permissionId);

    permission.deleteYn = 'Y';
    permission.updatedBy = userContext.userId;
    permission.updatedAt = new Date();

    return this.toResponse(await this.permissionRepository.save(permission));
  }

  private async findActiveByIdOrThrow(
    permissionId: string,
  ): Promise<Permission> {
    const normalizedPermissionId = this.requireTrimmedString(
      permissionId,
      'permissionId',
    );
    const permission = await this.permissionRepository.findOneBy({
      permissionId: normalizedPermissionId,
      deleteYn: 'N',
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
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

  private toResponse(permission: Permission): PermissionResponseDto {
    return {
      permissionId: permission.permissionId,
      module: permission.module,
      action: permission.action,
      name: permission.name,
      deleteYn: permission.deleteYn,
      createdBy: permission.createdBy,
      createdAt: permission.createdAt,
      updatedBy: permission.updatedBy,
      updatedAt: permission.updatedAt,
    };
  }
}
