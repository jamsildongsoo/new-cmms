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
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { AppModuleKey } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // List active departments in the authenticated user's company.
  @RequirePermission(AppModuleKey.DEPARTMENT, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.departmentsService.findAll(user);
  }

  // Get one active department in the authenticated user's company.
  @RequirePermission(AppModuleKey.DEPARTMENT, PermissionAction.READ)
  @Get(':deptId')
  findOne(@CurrentUser() user: UserContext, @Param('deptId') deptId: string) {
    return this.departmentsService.findOne(user, deptId);
  }

  // Create a department in the authenticated user's company.
  @RequirePermission(AppModuleKey.DEPARTMENT, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(user, dto);
  }

  // Update a department in the authenticated user's company.
  @RequirePermission(AppModuleKey.DEPARTMENT, PermissionAction.UPDATE)
  @Patch(':deptId')
  update(
    @CurrentUser() user: UserContext,
    @Param('deptId') deptId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(user, deptId, dto);
  }

  // Soft-delete a department in the authenticated user's company.
  @RequirePermission(AppModuleKey.DEPARTMENT, PermissionAction.DELETE)
  @Delete(':deptId')
  remove(@CurrentUser() user: UserContext, @Param('deptId') deptId: string) {
    return this.departmentsService.remove(user, deptId);
  }
}
