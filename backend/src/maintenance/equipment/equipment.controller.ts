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
import { AppModuleKey } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { SearchEquipmentDto } from './dto/search-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly numbering: NumberingService, private readonly equipmentService: EquipmentService) {}

  // List equipment with optional module-specific search.
  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchEquipmentDto,
  ) {
    return this.equipmentService.findAll(user, query);
  }

  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.equipmentService.getOptions(user);
  }

  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.READ)
  @Get('tree')
  tree(@CurrentUser() user: UserContext, @Query('siteId') siteId?: string) {
    return this.equipmentService.tree(user, siteId);
  }

  // Get one equipment master record.
  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.READ)
  @Get(':equipmentId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentService.findOne(user, equipmentId);
  }

  // Create one equipment master record.
  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateEquipmentDto) {
    return this.numbering.saveDocument(user, AppModuleKey.EQUIPMENT, dto.equipmentId.trim(), dto.attachmentId, () => this.equipmentService.create(user, dto));
  }

  // Update one equipment master record.
  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.UPDATE)
  @Patch(':equipmentId')
  update(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.numbering.saveDocument(user, AppModuleKey.EQUIPMENT, equipmentId, dto.attachmentId, () => this.equipmentService.update(user, equipmentId, dto));
  }

  // Soft-delete one equipment master record.
  @RequirePermission(AppModuleKey.EQUIPMENT, PermissionAction.DELETE)
  @Delete(':equipmentId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentService.remove(user, equipmentId);
  }
}
