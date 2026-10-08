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
import { CreateWorkPermitDto } from './dto/create-work-permit.dto';
import { UpdateWorkPermitDto } from './dto/update-work-permit.dto';
import { WorkPermitService } from './work-permit.service';

const permission = (action: PermissionAction) =>
  buildPermissionCode(AppModuleKey.WORK_PERMIT, action);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-permit')
export class WorkPermitController {
  constructor(private readonly service: WorkPermitService) {}

  @RequirePermissions(permission(PermissionAction.READ))
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermissions(permission(PermissionAction.READ))
  @Get(':workPermitId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.findOne(user, workPermitId);
  }

  @RequirePermissions(permission(PermissionAction.CREATE))
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWorkPermitDto) {
    return this.service.create(user, dto);
  }

  @RequirePermissions(permission(PermissionAction.UPDATE))
  @Patch(':workPermitId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
    @Body() dto: UpdateWorkPermitDto,
  ) {
    return this.service.update(user, workPermitId, dto);
  }

  @RequirePermissions(permission(PermissionAction.DELETE))
  @Delete(':workPermitId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workPermitId') workPermitId: string,
  ) {
    return this.service.remove(user, workPermitId);
  }
}
