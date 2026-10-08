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
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

const permission = (action: PermissionAction) =>
  buildPermissionCode(AppModuleKey.PREVENTIVE_MAINTENANCE, action);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('preventive-maintenance')
export class PreventiveMaintenanceController {
  constructor(private readonly service: PreventiveMaintenanceService) {}

  @RequirePermissions(permission(PermissionAction.READ))
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermissions(permission(PermissionAction.READ))
  @Get(':pmId')
  findOne(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.findOne(user, pmId);
  }

  @RequirePermissions(permission(PermissionAction.CREATE))
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePreventiveMaintenanceDto,
  ) {
    return this.service.create(user, dto);
  }

  @RequirePermissions(permission(PermissionAction.UPDATE))
  @Patch(':pmId')
  update(
    @CurrentUser() user: UserContext,
    @Param('pmId') pmId: string,
    @Body() dto: UpdatePreventiveMaintenanceDto,
  ) {
    return this.service.update(user, pmId, dto);
  }

  @RequirePermissions(permission(PermissionAction.DELETE))
  @Delete(':pmId')
  remove(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.remove(user, pmId);
  }
}
