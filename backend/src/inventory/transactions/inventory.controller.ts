import { PermissionAction } from '../../common/constants/permissions';
import { ModuleCode } from '../../common/constants/modules';
import { NumberingService } from '../../numbering/numbering.service';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  RequirePermission,
  RequirePermissions,
} from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import {
  CreateInventoryDto,
  InventorySearchDto,
  CancelInventoryDto,
  ConfirmInventoryDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';
/** 재고 전표 API. 동작 권한은 Guard가, 회사·사업장 범위와 월 잠금·처리 순서는 Service가 검사한다. */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory-document')
export class InventoryController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: InventoryService,
  ) {}
  @Get() @RequirePermission(ModuleCode.INVDOC, PermissionAction.READ) list(
    @CurrentUser() user: UserContext,
    @Query() query: InventorySearchDto,
  ) {
    return this.service.list(user, query);
  }
  @Get('options')
  @RequirePermission(ModuleCode.INVDOC, PermissionAction.READ)
  options(@CurrentUser() user: UserContext) {
    return this.service.options(user);
  }
  @Get('purchase-order/:id')
  @RequirePermission(ModuleCode.INVDOC, PermissionAction.READ)
  purchaseOrder(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.service.purchaseOrder(user, id);
  }
  @Get(':id') @RequirePermission(ModuleCode.INVDOC, PermissionAction.READ) get(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  // 일반 입력은 즉시 확정한다. 이동 출고에 딸린 대기 입고만 별도 confirm 경로를 사용한다.
  @Post() @RequirePermissions('INVDOC:read', 'INVDOC:create') create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateInventoryDto,
  ) {
    return this.numbering.createDocument(
      user,
      ModuleCode.INVDOC,
      (documentId) =>
        this.service.create(
          user,
          Object.assign({}, dto, { inventoryDocumentId: documentId }),
        ),
      dto.attachmentId,
    );
  }
  // 대기 전표를 새로 만들지 않고 기존 ID의 입고를 확정한다. 수령일은 이 요청에서 받는다.
  @Post(':id/confirm')
  @RequirePermissions('INVDOC:read', 'INVDOC:update')
  confirm(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: ConfirmInventoryDto,
  ) {
    return this.service.confirm(user, id, dto.postingDate);
  }
  @Post(':id/cancel')
  @RequirePermissions('INVDOC:read', 'INVDOC:update')
  cancel(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: CancelInventoryDto,
  ) {
    return this.service.cancel(user, id, dto.reason);
  }
}

// 권한 원본: backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
