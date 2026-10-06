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
import { CodeItemsService } from './code-items.service';
import { CreateCodeItemDto } from './dto/create-code-item.dto';
import { UpdateCodeItemDto } from './dto/update-code-item.dto';

const CODE_CREATE = buildPermissionCode(
  AppModuleKey.CODE,
  PermissionAction.CREATE,
);
const CODE_UPDATE = buildPermissionCode(
  AppModuleKey.CODE,
  PermissionAction.UPDATE,
);
const CODE_DELETE = buildPermissionCode(
  AppModuleKey.CODE,
  PermissionAction.DELETE,
);

@Controller()
export class CodeItemsController {
  constructor(private readonly codeItemsService: CodeItemsService) {}

  // Lookup code items for dropdowns by module or codeId.
  @UseGuards(JwtAuthGuard)
  @Get('code-items')
  findLookup(
    @CurrentUser() user: UserContext,
    @Query('module') module?: string,
    @Query('codeId') codeId?: string,
  ) {
    return this.codeItemsService.findLookup(user, { module, codeId });
  }

  // Create a code item under one category.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CODE_CREATE)
  @Post('code-categories/:codeId/items')
  create(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Body() dto: CreateCodeItemDto,
  ) {
    return this.codeItemsService.create(user, codeId, dto);
  }

  // Update a code item under one category.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CODE_UPDATE)
  @Patch('code-categories/:codeId/items/:codeItemId')
  update(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Param('codeItemId') codeItemId: string,
    @Body() dto: UpdateCodeItemDto,
  ) {
    return this.codeItemsService.update(user, codeId, codeItemId, dto);
  }

  // Soft-delete a code item under one category.
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(CODE_DELETE)
  @Delete('code-categories/:codeId/items/:codeItemId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Param('codeItemId') codeItemId: string,
  ) {
    return this.codeItemsService.remove(user, codeId, codeItemId);
  }
}
