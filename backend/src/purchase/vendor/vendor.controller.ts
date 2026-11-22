import { PermissionAction } from '../../common/constants/permissions';
import { ModuleCode } from '../../common/constants/modules';
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
import {
  CreateVendorDto,
  UpdateVendorDto,
  SearchVendorDto,
} from './dto/vendor.dto';
import { VendorService } from './vendor.service';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('vendor')
export class VendorController {
  constructor(private readonly service: VendorService) {}
  @Get() @RequirePermission(ModuleCode.VENDOR, PermissionAction.READ) list(
    @CurrentUser() user: UserContext,
    @Query() dto: SearchVendorDto,
  ) {
    return this.service.list(user, dto);
  }
  @Get(':id') @RequirePermission(ModuleCode.VENDOR, PermissionAction.READ) get(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post() @RequirePermission(ModuleCode.VENDOR, PermissionAction.CREATE) create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateVendorDto,
  ) {
    return this.service.create(user, dto);
  }
  @Patch(':id')
  @RequirePermission(ModuleCode.VENDOR, PermissionAction.UPDATE)
  update(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.service.update(user, id, dto);
  }
  @Get(':id/deletion-info')
  @RequirePermission(ModuleCode.VENDOR, PermissionAction.DELETE)
  deletionInfo(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.service.deletionInfo(user, id);
  }
  @Delete(':id')
  @RequirePermission(ModuleCode.VENDOR, PermissionAction.DELETE)
  remove(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
