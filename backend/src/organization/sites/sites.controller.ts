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
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

const SITE_READ = buildPermissionCode(AppModuleKey.SITE, PermissionAction.READ);
const SITE_CREATE = buildPermissionCode(
  AppModuleKey.SITE,
  PermissionAction.CREATE,
);
const SITE_UPDATE = buildPermissionCode(
  AppModuleKey.SITE,
  PermissionAction.UPDATE,
);
const SITE_DELETE = buildPermissionCode(
  AppModuleKey.SITE,
  PermissionAction.DELETE,
);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  // List active sites in the authenticated user's company.
  @RequirePermissions(SITE_READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.sitesService.findAll(user);
  }

  // Get one active site in the authenticated user's company.
  @RequirePermissions(SITE_READ)
  @Get(':siteId')
  findOne(@CurrentUser() user: UserContext, @Param('siteId') siteId: string) {
    return this.sitesService.findOne(user, siteId);
  }

  // Create a site in the authenticated user's company.
  @RequirePermissions(SITE_CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateSiteDto) {
    return this.sitesService.create(user, dto);
  }

  // Update a site in the authenticated user's company.
  @RequirePermissions(SITE_UPDATE)
  @Patch(':siteId')
  update(
    @CurrentUser() user: UserContext,
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(user, siteId, dto);
  }

  // Soft-delete a site in the authenticated user's company.
  @RequirePermissions(SITE_DELETE)
  @Delete(':siteId')
  remove(@CurrentUser() user: UserContext, @Param('siteId') siteId: string) {
    return this.sitesService.remove(user, siteId);
  }
}
