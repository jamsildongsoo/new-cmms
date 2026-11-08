import { AppModuleKey } from '../../common/constants/modules';
import { NumberingService } from '../../numbering/numbering.service';
import { Headers } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { SaveInventoryDto, InventorySearchDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inventory-document')
export class InventoryController {
  constructor(
    private readonly numbering: NumberingService,
    private readonly service: InventoryService,
  ) {}
  @Get() @RequirePermission('inventory_document', 'read') list(
    @CurrentUser() user: UserContext,
    @Query() query: InventorySearchDto,
  ) {
    return this.service.list(user, query);
  }
  @Get('options') @RequirePermission('inventory_document', 'read') options(
    @CurrentUser() user: UserContext,
  ) {
    return this.service.options(user);
  }
  @Post('initialize-types') @RequirePermission('code', 'update') initialize(
    @CurrentUser() user: UserContext,
  ) {
    return this.service.initializeTypes(user);
  }
  @Get('reference/:module/:id')
  @RequirePermission('inventory_document', 'read')
  reference(
    @CurrentUser() user: UserContext,
    @Param('module') module: string,
    @Param('id') id: string,
  ) {
    return this.service.reference(user, module, id);
  }
  @Get(':id') @RequirePermission('inventory_document', 'read') get(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.service.get(user, id);
  }
  @Post() @RequirePermission('inventory_document', 'create') create(
    @CurrentUser() user: UserContext,
    @Body() dto: SaveInventoryDto,
    @Headers('idempotency-key') requestKey: string,
  ) {
    return this.numbering.createDocument(
      user,
      AppModuleKey.INVENTORY_DOCUMENT,
      requestKey,
      (documentId) =>
        this.service.save(
          user,
          Object.assign({}, dto, { inventoryDocumentId: documentId }),
        ),
      (documentId) => this.service.get(user, documentId),
      dto.attachmentId,
    );
  }
  @Patch(':id') @RequirePermission('inventory_document', 'update') update(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: SaveInventoryDto,
  ) {
    return this.numbering.saveDocument(
      user,
      AppModuleKey.INVENTORY_DOCUMENT,
      id,
      dto.attachmentId,
      () => this.service.save(user, dto, id),
    );
  }
  @Delete(':id') @RequirePermission('inventory_document', 'delete') remove(
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.service.remove(user, id);
  }
  @Post(':id/confirm')
  @RequirePermission('inventory_document', 'update')
  confirm(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.service.confirm(user, id);
  }
}
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stock-status')
export class StockStatusController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePermission('stock_status', 'read') list(
    @CurrentUser() user: UserContext,
    @Query() query: InventorySearchDto,
  ) {
    return this.service.balances(user, query);
  }
}
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stock-ledger')
export class StockLedgerController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePermission('stock_ledger', 'read') list(
    @CurrentUser() user: UserContext,
    @Query() query: InventorySearchDto,
  ) {
    return this.service.ledger(user, query);
  }
}
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('monthly-closing')
export class MonthlyClosingController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePermission('monthly_closing', 'read') list(
    @CurrentUser() user: UserContext,
  ) {
    return this.service.periods(user);
  }
  @Get(':month') @RequirePermission('monthly_closing', 'read') month(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.monthly(user, month);
  }
  @Post(':month/open') @RequirePermission('monthly_closing', 'update') open(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'open');
  }
  @Post(':month/unlock') @RequirePermission('monthly_closing', 'update') unlock(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'unlock');
  }
  @Post(':month/close') @RequirePermission('monthly_closing', 'update') close(
    @CurrentUser() user: UserContext,
    @Param('month') month: string,
  ) {
    return this.service.periodAction(user, month, 'close');
  }
}
