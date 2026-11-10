import { MaxLength } from 'class-validator';
import { IsString } from 'class-validator';
import { NumberingService } from '../../numbering/numbering.service';
import { Headers } from '@nestjs/common';
import { IsArray, ArrayUnique } from 'class-validator';
class PreviewRequestsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  requestIds: string[];
}
import { PurchaseSearchDto } from '../common/purchase-search.dto';
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
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-order')
export class PurchaseOrderController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: PurchaseOrderService,
  ) {}

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: PurchaseSearchDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.READ)
  @Post('request-preview')
  preview(@CurrentUser() user: UserContext, @Body() dto: PreviewRequestsDto) {
    return this.service.preview(user, dto.requestIds);
  }
  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.READ)
  @Get(':orderId')
  findOne(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.findOne(user, orderId);
  }

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseOrderDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.PURCHASE_ORDER,
      requestKey,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { orderId: documentId }),
        ),
      (documentId) => this.service.findOne(user, documentId),
      dto.attachmentId,
    );
  }

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.UPDATE)
  @Patch(':orderId')
  update(
    @CurrentUser() user: UserContext,
    @Param('orderId') orderId: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.PURCHASE_ORDER,
      orderId,
      dto.attachmentId,
      () => this.service.update(user, orderId, dto),
    );
  }

  @RequirePermission(AppModuleKey.PURCHASE_ORDER, PermissionAction.DELETE)
  @Delete(':orderId')
  remove(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.remove(user, orderId);
  }
}
