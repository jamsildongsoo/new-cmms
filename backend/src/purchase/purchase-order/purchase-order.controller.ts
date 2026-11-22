import { MaxLength, IsString } from 'class-validator';
import { NumberingService } from '../../numbering/numbering.service';
class PreviewRequestDto {
  @IsString() @MaxLength(50) requestId: string;
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
import { ModuleCode } from '../../common/constants/modules';
import { PermissionAction } from '../../common/constants/permissions';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';

/** 구매오더 API. 요청 미리보기는 복사용 조회이며 발주 저장·수정과 분리한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-order')
export class PurchaseOrderController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: PurchaseOrderService,
  ) {}

  @RequirePermission(ModuleCode.PURORD, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: PurchaseSearchDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.PURORD, PermissionAction.READ)
  // POST지만 문서를 저장하지 않는다. 원문 접근·완결 여부를 검사하고 최초 복사할 값만 반환한다.
  @Post('request-preview')
  preview(@CurrentUser() user: UserContext, @Body() dto: PreviewRequestDto) {
    return this.service.preview(user, dto.requestId);
  }
  @RequirePermission(ModuleCode.PURORD, PermissionAction.READ)
  @Get('request/:requestId/orders')
  linkedOrders(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.linkedOrders(user, requestId);
  }
  @RequirePermission(ModuleCode.PURORD, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }

  @RequirePermission(ModuleCode.PURORD, PermissionAction.READ)
  @Get(':orderId')
  findOne(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.findOne(user, orderId);
  }

  @RequirePermission(ModuleCode.PURORD, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.numbering.createDocument(
      user,
      ModuleCode.PURORD,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { orderId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.PURORD, PermissionAction.UPDATE)
  @Patch(':orderId')
  update(
    @CurrentUser() user: UserContext,
    @Param('orderId') orderId: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.PURORD,
      orderId,
      dto.attachmentId,
      () => this.service.update(user, orderId, dto),
    );
  }

  @RequirePermission(ModuleCode.PURORD, PermissionAction.DELETE)
  @Delete(':orderId')
  remove(@CurrentUser() user: UserContext, @Param('orderId') orderId: string) {
    return this.service.remove(user, orderId);
  }
}
