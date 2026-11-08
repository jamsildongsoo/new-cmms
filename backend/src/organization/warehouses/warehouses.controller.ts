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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  // List active warehouses in the authenticated user's company.
  @RequirePermission(AppModuleKey.WAREHOUSE, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.warehousesService.findAll(user);
  }

  // Get one active warehouse in the authenticated user's company.
  @RequirePermission(AppModuleKey.WAREHOUSE, PermissionAction.READ)
  @Get(':siteId/:warehouseId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('siteId') siteId: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    return this.warehousesService.findOne(user, siteId, warehouseId);
  }

  // Create a warehouse in the authenticated user's company.
  @RequirePermission(AppModuleKey.WAREHOUSE, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user, dto);
  }

  // Update a warehouse in the authenticated user's company.
  @RequirePermission(AppModuleKey.WAREHOUSE, PermissionAction.UPDATE)
  @Patch(':siteId/:warehouseId')
  update(
    @CurrentUser() user: UserContext,
    @Param('siteId') siteId: string,
    @Param('warehouseId') warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(user, siteId, warehouseId, dto);
  }

  // Soft-delete a warehouse in the authenticated user's company.
  @RequirePermission(AppModuleKey.WAREHOUSE, PermissionAction.DELETE)
  @Delete(':siteId/:warehouseId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('siteId') siteId: string,
    @Param('warehouseId') warehouseId: string,
  ) {
    return this.warehousesService.remove(user, siteId, warehouseId);
  }
}
