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
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('preventive-maintenance')
export class PreventiveMaintenanceController {
  constructor(private readonly service: PreventiveMaintenanceService) {}

  @RequirePermission(AppModuleKey.PREVENTIVE_MAINTENANCE, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermission(AppModuleKey.PREVENTIVE_MAINTENANCE, PermissionAction.READ)
  @Get(':pmId')
  findOne(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.findOne(user, pmId);
  }

  @RequirePermission(
    AppModuleKey.PREVENTIVE_MAINTENANCE,
    PermissionAction.CREATE,
  )
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePreventiveMaintenanceDto,
  ) {
    return this.service.create(user, dto);
  }

  @RequirePermission(
    AppModuleKey.PREVENTIVE_MAINTENANCE,
    PermissionAction.UPDATE,
  )
  @Patch(':pmId')
  update(
    @CurrentUser() user: UserContext,
    @Param('pmId') pmId: string,
    @Body() dto: UpdatePreventiveMaintenanceDto,
  ) {
    return this.service.update(user, pmId, dto);
  }

  @RequirePermission(
    AppModuleKey.PREVENTIVE_MAINTENANCE,
    PermissionAction.DELETE,
  )
  @Delete(':pmId')
  remove(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.remove(user, pmId);
  }
}
