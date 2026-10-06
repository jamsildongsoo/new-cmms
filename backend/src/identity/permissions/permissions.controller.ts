import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { AppModuleKey } from '../../common/constants/modules';
import {
  buildPermissionCode,
  PermissionAction,
} from '../../common/constants/permissions';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

const PERMISSION_READ = buildPermissionCode(
  AppModuleKey.PERMISSION,
  PermissionAction.READ,
);
const PERMISSION_CREATE = buildPermissionCode(
  AppModuleKey.PERMISSION,
  PermissionAction.CREATE,
);
const PERMISSION_UPDATE = buildPermissionCode(
  AppModuleKey.PERMISSION,
  PermissionAction.UPDATE,
);
const PERMISSION_DELETE = buildPermissionCode(
  AppModuleKey.PERMISSION,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // List active system permission definitions.
  @RequirePermissions(PERMISSION_READ)
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  // Get one active system permission definition.
  @RequirePermissions(PERMISSION_READ)
  @Get(':permissionId')
  findOne(@Param('permissionId') permissionId: string) {
    return this.permissionsService.findOne(permissionId);
  }

  // Create a system permission definition.
  @RequirePermissions(PERMISSION_CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() createPermissionDto: CreatePermissionDto,
  ) {
    return this.permissionsService.create(user, createPermissionDto);
  }

  // Update a system permission definition.
  @RequirePermissions(PERMISSION_UPDATE)
  @Patch(':permissionId')
  update(
    @CurrentUser() user: UserContext,
    @Param('permissionId') permissionId: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(
      user,
      permissionId,
      updatePermissionDto,
    );
  }

  // Soft-delete a system permission definition.
  @RequirePermissions(PERMISSION_DELETE)
  @Delete(':permissionId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('permissionId') permissionId: string,
  ) {
    return this.permissionsService.remove(user, permissionId);
  }
}
