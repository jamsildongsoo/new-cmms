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
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';

const permission = (action: PermissionAction) =>
  buildPermissionCode(AppModuleKey.PURCHASE_ORDER, action);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-order')
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @RequirePermissions(permission(PermissionAction.READ))
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermissions(permission(PermissionAction.READ))
  @Get(':orderId')
  findOne(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.findOne(user, orderId);
  }

  @RequirePermissions(permission(PermissionAction.CREATE))
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.service.create(user, dto);
  }

  @RequirePermissions(permission(PermissionAction.UPDATE))
  @Patch(':orderId')
  update(
    @CurrentUser() user: UserContext,
    @Param('orderId') orderId: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.update(user, orderId, dto);
  }

  @RequirePermissions(permission(PermissionAction.DELETE))
  @Delete(':orderId')
  remove(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.remove(user, orderId);
  }
}
