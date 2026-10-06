import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_READ = buildPermissionCode(
  AppModuleKey.COMPANY,
  PermissionAction.READ,
);
const COMPANY_CREATE = buildPermissionCode(
  AppModuleKey.COMPANY,
  PermissionAction.CREATE,
);
const COMPANY_UPDATE = buildPermissionCode(
  AppModuleKey.COMPANY,
  PermissionAction.UPDATE,
);
const COMPANY_DELETE = buildPermissionCode(
  AppModuleKey.COMPANY,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Get the authenticated user's company master data.
  @RequirePermissions(COMPANY_READ)
  @Get()
  findMine(@CurrentUser() user: UserContext) {
    return this.companiesService.findMine(user);
  }

  // Create the authenticated user's company master data.
  @RequirePermissions(COMPANY_CREATE)
  @Post()
  createMine(@CurrentUser() user: UserContext, @Body() dto: CreateCompanyDto) {
    return this.companiesService.createMine(user, dto);
  }

  // Update the authenticated user's company master data.
  @RequirePermissions(COMPANY_UPDATE)
  @Patch()
  updateMine(@CurrentUser() user: UserContext, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMine(user, dto);
  }

  // Soft-delete the authenticated user's company master data.
  @RequirePermissions(COMPANY_DELETE)
  @Delete()
  removeMine(@CurrentUser() user: UserContext) {
    return this.companiesService.removeMine(user);
  }
}
