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
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { WorkOrderService } from './work-order.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('work-order')
export class WorkOrderController {
  constructor(private readonly service: WorkOrderService) {}

  @RequirePermission(AppModuleKey.WORK_ORDER, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermission(AppModuleKey.WORK_ORDER, PermissionAction.READ)
  @Get(':workOrderId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.service.findOne(user, workOrderId);
  }

  @RequirePermission(AppModuleKey.WORK_ORDER, PermissionAction.CREATE)
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateWorkOrderDto) {
    return this.service.create(user, dto);
  }

  @RequirePermission(AppModuleKey.WORK_ORDER, PermissionAction.UPDATE)
  @Patch(':workOrderId')
  update(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    return this.service.update(user, workOrderId, dto);
  }

  @RequirePermission(AppModuleKey.WORK_ORDER, PermissionAction.DELETE)
  @Delete(':workOrderId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.service.remove(user, workOrderId);
  }
}
