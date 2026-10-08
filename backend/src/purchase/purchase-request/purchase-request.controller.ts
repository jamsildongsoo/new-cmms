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
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseRequestService } from './purchase-request.service';

const permission = (action: PermissionAction) =>
  buildPermissionCode(AppModuleKey.PURCHASE_REQUEST, action);

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-request')
export class PurchaseRequestController {
  constructor(private readonly service: PurchaseRequestService) {}

  @RequirePermissions(permission(PermissionAction.READ))
  @Get()
  findAll(@CurrentUser() user: UserContext) {
    return this.service.findAll(user);
  }

  @RequirePermissions(permission(PermissionAction.READ))
  @Get(':requestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.findOne(user, requestId);
  }

  @RequirePermissions(permission(PermissionAction.CREATE))
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.service.create(user, dto);
  }

  @RequirePermissions(permission(PermissionAction.UPDATE))
  @Patch(':requestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.service.update(user, requestId, dto);
  }

  @RequirePermissions(permission(PermissionAction.DELETE))
  @Delete(':requestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.remove(user, requestId);
  }
}
