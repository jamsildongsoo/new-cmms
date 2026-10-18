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
import { CodeItemsService } from './code-items.service';
import { CreateCodeItemDto } from './dto/create-code-item.dto';
import { UpdateCodeItemDto } from './dto/update-code-item.dto';

@Controller('code-items')
export class CodeItemsController {
  constructor(private readonly codeItemsService: CodeItemsService) {}

  // List items of one code, e.g. for dropdowns.
  @UseGuards(JwtAuthGuard)
  @Get()
  findByCode(
    @CurrentUser() user: UserContext,
    @Query('codeId') codeId: string,
  ) {
    return this.codeItemsService.findByCode(user, codeId);
  }

  // Get one code item.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AppModuleKey.CODE, PermissionAction.READ)
  @Get(':codeId/:codeItemId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Param('codeItemId') codeItemId: string,
  ) {
    return this.codeItemsService.findOne(user, codeId, codeItemId);
  }

  // Create a code item.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AppModuleKey.CODE, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateCodeItemDto) {
    return this.codeItemsService.create(user, dto);
  }

  // Update a code item.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AppModuleKey.CODE, PermissionAction.UPDATE)
  @Patch(':codeId/:codeItemId')
  update(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Param('codeItemId') codeItemId: string,
    @Body() dto: UpdateCodeItemDto,
  ) {
    return this.codeItemsService.update(user, codeId, codeItemId, dto);
  }

  // Delete a code item.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(AppModuleKey.CODE, PermissionAction.DELETE)
  @Delete(':codeId/:codeItemId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Param('codeItemId') codeItemId: string,
  ) {
    return this.codeItemsService.remove(user, codeId, codeItemId);
  }
}
