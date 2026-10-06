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
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { AppModuleKey } from '../../common/constants/modules';
import {
  buildPermissionCode,
  PermissionAction,
} from '../../common/constants/permissions';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { SearchEquipmentDto } from './dto/search-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

const EQUIPMENT_CREATE = buildPermissionCode(
  AppModuleKey.EQUIPMENT,
  PermissionAction.CREATE,
);
const EQUIPMENT_READ = buildPermissionCode(
  AppModuleKey.EQUIPMENT,
  PermissionAction.READ,
);
const EQUIPMENT_UPDATE = buildPermissionCode(
  AppModuleKey.EQUIPMENT,
  PermissionAction.UPDATE,
);
const EQUIPMENT_DELETE = buildPermissionCode(
  AppModuleKey.EQUIPMENT,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // List equipment with optional module-specific search.
  @RequirePermissions(EQUIPMENT_READ)
  @Get()
  findAll(
    @CurrentUser() user: UserContext,
    @Query() query: SearchEquipmentDto,
  ) {
    return this.equipmentService.findAll(user, query);
  }

  // Get one equipment master record.
  @RequirePermissions(EQUIPMENT_READ)
  @Get(':equipmentId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentService.findOne(user, equipmentId);
  }

  // Create one equipment master record.
  @RequirePermissions(EQUIPMENT_CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateEquipmentDto) {
    return this.equipmentService.create(user, dto);
  }

  // Update one equipment master record.
  @RequirePermissions(EQUIPMENT_UPDATE)
  @Patch(':equipmentId')
  update(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipmentService.update(user, equipmentId, dto);
  }

  // Soft-delete one equipment master record.
  @RequirePermissions(EQUIPMENT_DELETE)
  @Delete(':equipmentId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.equipmentService.remove(user, equipmentId);
  }
}
