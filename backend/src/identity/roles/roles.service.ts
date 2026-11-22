/** 역할·권한 배정은 회사별로 관리하고 지원 권한은 시스템 상수에서 읽는다. */
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
import {
  PERMISSION_OPTIONS,
  isPermissionCode,
} from '../../common/constants/permissions';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async findPermissionOptions() {
    return PERMISSION_OPTIONS;
  }

  async findAssignedPermissionIds(
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

    return rolePermissions
      .map((rolePermission) => rolePermission.permissionId)
      .filter(isPermissionCode);
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
    return this.findAssignedPermissionIds(userContext.companyId, roleId);
  }

  async updatePermissions(
    userContext: UserContext,
    roleId: string,
    updateRolePermissionsDto: UpdateRolePermissionsDto,
  ): Promise<string[]> {
    const permissionIds = this.normalizePermissionIds(
      updateRolePermissionsDto.permissionIds,
    );
    if (permissionIds.some((id) => !isPermissionCode(id)))
      throw new BadRequestException('시스템에 정의되지 않은 권한입니다.');
    return this.roleRepository.manager.transaction(async (manager) => {
      const role = await manager.getRepository(Role).findOne({
        where: { companyId: userContext.companyId, roleId, deleteYn: 'N' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!role) throw new NotFoundException('Role not found');
      const repo = manager.getRepository(RolePermission);
      await repo.delete({ companyId: userContext.companyId, roleId });
      if (permissionIds.length)
        await repo.save(
          permissionIds.map((permissionId) =>
            repo.create({
              companyId: userContext.companyId,
              roleId,
              permissionId,
            }),
          ),
        );
      return permissionIds;
    });
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
