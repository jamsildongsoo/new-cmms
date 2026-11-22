import { SearchPreventiveMaintenanceDto } from './dto/search-preventive-maintenance.dto';
import { NumberingService } from '../../numbering/numbering.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { ModuleCode } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreatePreventiveMaintenanceDto } from './dto/create-preventive-maintenance.dto';
import { UpdatePreventiveMaintenanceDto } from './dto/update-preventive-maintenance.dto';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

/** PM API. 점검 문서 저장과 결재 완결에 따른 설비 날짜 반영은 서로 다른 처리 단계다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('preventive-maintenance')
export class PreventiveMaintenanceController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: PreventiveMaintenanceService,
  ) {}

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchPreventiveMaintenanceDto,
  ) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.service.getOptions(user);
  }

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.READ)
  @Get(':pmId')
  findOne(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.findOne(user, pmId);
  }

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePreventiveMaintenanceDto,
  ) {
    return this.numbering.createDocument(
      user,
      ModuleCode.PMAINT,
      (documentId) =>
        this.service.create(user, Object.assign({}, dto, { pmId: documentId })),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.UPDATE)
  @Patch(':pmId')
  update(
    @CurrentUser() user: UserContext,
    @Param('pmId') pmId: string,
    @Body() dto: UpdatePreventiveMaintenanceDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.PMAINT,
      pmId,
      dto.attachmentId,
      () => this.service.update(user, pmId, dto),
    );
  }

  @RequirePermission(ModuleCode.PMAINT, PermissionAction.DELETE)
  @Delete(':pmId')
  remove(@CurrentUser() user: UserContext, @Param('pmId') pmId: string) {
    return this.service.remove(user, pmId);
  }
}
