import { NumberingService } from '../../numbering/numbering.service';
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
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { PurchaseRequestService } from './purchase-request.service';

/** 구매요청 API. 문서 ID·첨부 연결은 NumberingService를 거치고 요청 품목 저장은 업무 Service에 맡긴다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchase-request')
export class PurchaseRequestController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: PurchaseRequestService,
  ) {}

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.READ)
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: PurchaseSearchDto) {
    return this.service.findAll(user, query);
  }

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.READ)
  @Get('options')
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.READ)
  @Get(':requestId')
  findOne(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.findOne(user, requestId);
  }

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.CREATE)
  @Post()
  create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.numbering.createDocument(
      user,
      ModuleCode.PURREQ,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { requestId: documentId }),
        ),
      dto.attachmentId,
    );
  }

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.UPDATE)
  @Patch(':requestId')
  update(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
    @Body() dto: UpdatePurchaseRequestDto,
  ) {
    return this.numbering.saveDocument(
      user,
      ModuleCode.PURREQ,
      requestId,
      dto.attachmentId,
      () => this.service.update(user, requestId, dto),
    );
  }

  @RequirePermission(ModuleCode.PURREQ, PermissionAction.DELETE)
  @Delete(':requestId')
  remove(
    @CurrentUser() user: UserContext,
    @Param('requestId') requestId: string,
  ) {
    return this.service.remove(user, requestId);
  }
}
