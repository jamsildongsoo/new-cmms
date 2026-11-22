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
import { CreateMaterialDto } from './dto/create-material.dto';
import { SearchMaterialDto } from './dto/search-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialService } from './material.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('material')
export class MaterialController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly materialService: MaterialService,
  ) {}

  // List material with optional module-specific search.
  @RequirePermission(ModuleCode.MATL, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: SearchMaterialDto) {
    return this.materialService.findAll(user, query);
  }

  @RequirePermission(ModuleCode.MATL, PermissionAction.READ)
  @Get('options')
  getOptions(@CurrentUser() user: UserContext) {
    return this.materialService.getOptions(user);
  }

  // Get one material master record.
  @RequirePermission(ModuleCode.MATL, PermissionAction.READ)
  @Get(':materialId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('materialId') materialId: string,
  ) {
    return this.materialService.findOne(user, materialId);
  }

  // Create one material master record.
  @RequirePermission(ModuleCode.MATL, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateMaterialDto) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.MATL,
      dto.materialId.trim(),
      dto.attachmentId,
      () => this.materialService.create(user, dto),
    );
  }

  // Update one material master record.
  @RequirePermission(ModuleCode.MATL, PermissionAction.UPDATE)
  @Patch(':materialId')
  update(
    @CurrentUser() user: UserContext,
    @Param('materialId') materialId: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.MATL,
      materialId,
      dto.attachmentId,
      () => this.materialService.update(user, materialId, dto),
    );
  }

  // Soft-delete one material master record.
  @RequirePermission(ModuleCode.MATL, PermissionAction.DELETE)
  @Delete(':materialId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('materialId') materialId: string,
  ) {
    return this.materialService.remove(user, materialId);
  }
}
