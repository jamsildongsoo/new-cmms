import { NumberingService } from '../../numbering/numbering.service';
import { Headers } from '@nestjs/common';
import { PurchaseSearchDto } from '../common/purchase.dto';
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
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseRequestService } from './purchase-request.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-request')
export class PurchaseRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: PurchaseRequestService,
  ) {}

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: PurchaseSearchDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.READ)
  @Get(':requestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.findOne(user, requestId);
  }

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseRequestDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.PURCHASE_REQUEST,
      requestKey,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { requestId: documentId }),
        ),
      (documentId) => this.service.findOne(user, documentId),
      dto.attachmentId,
    );
  }

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.UPDATE)
  @Patch(':requestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.PURCHASE_REQUEST,
      requestId,
      dto.attachmentId,
      () => this.service.update(user, requestId, dto),
    );
  }

  @RequirePermission(AppModuleKey.PURCHASE_REQUEST, PermissionAction.DELETE)
  @Delete(':requestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.remove(user, requestId);
  }
}
