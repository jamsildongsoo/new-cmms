import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { AppModuleKey } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // List active roles in the authenticated user's company.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.rolesService.findAll(user);
  }

  // Get one active role in the authenticated user's company.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.READ)
  @Get(':roleId')
  findOne(@CurrentUser() user: UserContext, @Param('roleId') roleId: string) {
    return this.rolesService.findOne(user, roleId);
  }

  // Create a role in the authenticated user's company.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.rolesService.create(user, createRoleDto);
  }

  // Update a role name in the authenticated user's company.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.UPDATE)
  @Patch(':roleId')
  update(
    @CurrentUser() user: UserContext,
    @Param('roleId') roleId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(user, roleId, updateRoleDto);
  }

  // Soft-delete a role in the authenticated user's company.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.DELETE)
  @Delete(':roleId')
  remove(@CurrentUser() user: UserContext, @Param('roleId') roleId: string) {
    return this.rolesService.remove(user, roleId);
  }

  // List permission codes currently assigned to one role.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.READ)
  @Get(':roleId/permissions')
  findPermissions(
    @CurrentUser() user: UserContext,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.findPermissions(user, roleId);
  }

  // Replace the permission codes assigned to one role.
  @RequirePermission(AppModuleKey.ROLE, PermissionAction.UPDATE)
  @Put(':roleId/permissions')
  updatePermissions(
    @CurrentUser() user: UserContext,
    @Param('roleId') roleId: string,
    @Body() updateRolePermissionsDto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(
      user,
      roleId,
      updateRolePermissionsDto,
    );
  }
}
