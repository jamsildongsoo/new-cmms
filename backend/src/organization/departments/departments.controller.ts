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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

const DEPARTMENT_READ = buildPermissionCode(
  AppModuleKey.DEPARTMENT,
  PermissionAction.READ,
);
const DEPARTMENT_CREATE = buildPermissionCode(
  AppModuleKey.DEPARTMENT,
  PermissionAction.CREATE,
);
const DEPARTMENT_UPDATE = buildPermissionCode(
  AppModuleKey.DEPARTMENT,
  PermissionAction.UPDATE,
);
const DEPARTMENT_DELETE = buildPermissionCode(
  AppModuleKey.DEPARTMENT,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // List active departments in the authenticated user's company.
  @RequirePermissions(DEPARTMENT_READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.departmentsService.findAll(user);
  }

  // Get one active department in the authenticated user's company.
  @RequirePermissions(DEPARTMENT_READ)
  @Get(':deptId')
  findOne(@CurrentUser() user: UserContext, @Param('deptId') deptId: string) {
    return this.departmentsService.findOne(user, deptId);
  }

  // Create a department in the authenticated user's company.
  @RequirePermissions(DEPARTMENT_CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(user, dto);
  }

  // Update a department in the authenticated user's company.
  @RequirePermissions(DEPARTMENT_UPDATE)
  @Patch(':deptId')
  update(
    @CurrentUser() user: UserContext,
    @Param('deptId') deptId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user, deptId, dto);
  }

  // Soft-delete a department in the authenticated user's company.
  @RequirePermissions(DEPARTMENT_DELETE)
  @Delete(':deptId')
  remove(@CurrentUser() user: UserContext, @Param('deptId') deptId: string) {
    return this.departmentsService.remove(user, deptId);
  }
}
