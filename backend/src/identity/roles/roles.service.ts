import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserContext } from '../../auth/types/user-context.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async findActivePermissionIds(
    companyId: string,
    roleId: string,
  ): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: {
        companyId,
        roleId,
      },
      order: {
        permissionId: 'ASC',
      },
    });

    return rolePermissions.map((rolePermission) => rolePermission.permissionId);
  }

  async findAll(userContext: UserContext): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.find({
      where: {
        companyId: userContext.companyId,
        deleteYn: 'N',
      },
      order: {
        roleId: 'ASC',
      },
    });

    return roles.map((role) => this.toResponse(role));
  }

  async findOne(
    userContext: UserContext,
    roleId: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findActiveByIdOrThrow(
      userContext.companyId,
      roleId,
    );
    return this.toResponse(role);
  }

  async create(
    userContext: UserContext,
    createRoleDto: CreateRoleDto,
  ): Promise<RoleResponseDto> {
    const roleId = this.requireTrimmedString(createRoleDto.roleId, 'roleId');
    const name = this.requireTrimmedString(createRoleDto.name, 'name');
    const existingRole = await this.roleRepository.findOneBy({
      companyId: userContext.companyId,
      roleId,
    });

    if (existingRole) {
      throw new ConflictException('Role already exists');
    }

    const role = this.roleRepository.create({
      companyId: userContext.companyId,
      roleId,
      name,
      deleteYn: 'N',
      createdBy: userContext.userId,
    });

    return this.toResponse(await this.roleRepository.save(role));
  }

  async update(
    userContext: UserContext,
    roleId: string,
    updateRoleDto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    const role = await this.findActiveByIdOrThrow(
      userContext.companyId,
      roleId,
    );

    if (updateRoleDto.name !== undefined) {
      role.name = this.requireTrimmedString(updateRoleDto.name, 'name');
    }

    role.updatedBy = userContext.userId;
    role.updatedAt = new Date();

    return this.toResponse(await this.roleRepository.save(role));
  }

  async remove(
    userContext: UserContext,
    roleId: string,
  ): Promise<RoleResponseDto> {
    const role = await this.findActiveByIdOrThrow(
      userContext.companyId,
      roleId,
    );

    role.deleteYn = 'Y';
    role.updatedBy = userContext.userId;
    role.updatedAt = new Date();

    return this.toResponse(await this.roleRepository.save(role));
  }

  async findPermissions(
    userContext: UserContext,
    roleId: string,
  ): Promise<string[]> {
    await this.findActiveByIdOrThrow(userContext.companyId, roleId);
    return this.findActivePermissionIds(userContext.companyId, roleId);
  }

  async updatePermissions(
    userContext: UserContext,
    roleId: string,
    updateRolePermissionsDto: UpdateRolePermissionsDto,
  ): Promise<string[]> {
    await this.findActiveByIdOrThrow(userContext.companyId, roleId);
    const permissionIds = this.normalizePermissionIds(
      updateRolePermissionsDto.permissionIds,
    );
    const existingRolePermissions = await this.rolePermissionRepository.find({
      where: {
        companyId: userContext.companyId,
        roleId,
      },
    });
    const requestedPermissionIds = new Set(permissionIds);
    const removedRolePermissions = existingRolePermissions.filter(
      (rolePermission) =>
        !requestedPermissionIds.has(rolePermission.permissionId),
    );
    const existingPermissionIds = new Set(
      existingRolePermissions.map(
        (rolePermission) => rolePermission.permissionId,
      ),
    );
    const newRolePermissions = permissionIds
      .filter((permissionId) => !existingPermissionIds.has(permissionId))
      .map((permissionId) =>
        this.rolePermissionRepository.create({
          companyId: userContext.companyId,
          roleId,
          permissionId,
        }),
      );

    await this.rolePermissionRepository.remove(removedRolePermissions);
    await this.rolePermissionRepository.save(newRolePermissions);

    return this.findActivePermissionIds(userContext.companyId, roleId);
  }

  private async findActiveByIdOrThrow(
    companyId: string,
    roleId: string,
  ): Promise<Role> {
    const role = await this.roleRepository.findOneBy({
      companyId,
      roleId,
      deleteYn: 'N',
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  private normalizePermissionIds(
    permissionIds: string[] | undefined,
  ): string[] {
    if (!Array.isArray(permissionIds)) {
      throw new BadRequestException('permissionIds must be an array');
    }

    const normalizedPermissionIds = permissionIds.map((permissionId) =>
      this.requireTrimmedString(permissionId, 'permissionId'),
    );

    return [...new Set(normalizedPermissionIds)].sort();
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

  private toResponse(role: Role): RoleResponseDto {
    return {
      companyId: role.companyId,
      roleId: role.roleId,
      name: role.name,
      deleteYn: role.deleteYn,
      createdBy: role.createdBy,
      createdAt: role.createdAt,
      updatedBy: role.updatedBy,
      updatedAt: role.updatedAt,
    };
  }
}
