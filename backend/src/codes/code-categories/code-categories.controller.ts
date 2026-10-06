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
import { CodeItemsService } from '../code-items/code-items.service';
import { CodeCategoriesService } from './code-categories.service';
import { CreateCodeCategoryDto } from './dto/create-code-category.dto';
import { UpdateCodeCategoryDto } from './dto/update-code-category.dto';

const CODE_READ = buildPermissionCode(AppModuleKey.CODE, PermissionAction.READ);
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

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('code-categories')
export class CodeCategoriesController {
  constructor(
    private readonly codeCategoriesService: CodeCategoriesService,
    private readonly codeItemsService: CodeItemsService,
  ) {}

  // List active code categories in the authenticated user's company.
  @RequirePermissions(CODE_READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.codeCategoriesService.findAll(user);
  }

  // Get one active code category in the authenticated user's company.
  @RequirePermissions(CODE_READ)
  @Get(':codeId')
  findOne(@CurrentUser() user: UserContext, @Param('codeId') codeId: string) {
    return this.codeCategoriesService.findOne(user, codeId);
  }

  // Create a code category linked to one module.
  @RequirePermissions(CODE_CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateCodeCategoryDto) {
    return this.codeCategoriesService.create(user, dto);
  }

  // Update a code category name or owning module.
  @RequirePermissions(CODE_UPDATE)
  @Patch(':codeId')
  update(
    @CurrentUser() user: UserContext,
    @Param('codeId') codeId: string,
    @Body() dto: UpdateCodeCategoryDto,
  ) {
    return this.codeCategoriesService.update(user, codeId, dto);
  }

  // Soft-delete a code category.
  @RequirePermissions(CODE_DELETE)
  @Delete(':codeId')
  remove(@CurrentUser() user: UserContext, @Param('codeId') codeId: string) {
    return this.codeCategoriesService.remove(user, codeId);
  }

  // List active code items under one category for management screens.
  @RequirePermissions(CODE_READ)
  @Get(':codeId/items')
  findItems(@CurrentUser() user: UserContext, @Param('codeId') codeId: string) {
    return this.codeItemsService.findByCategory(user, codeId);
  }
}
