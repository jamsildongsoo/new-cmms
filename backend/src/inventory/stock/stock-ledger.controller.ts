import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import type { UserContext } from '../../auth/types/user-context.type';
import { InventorySearchDto } from '../transactions/dto/inventory.dto';
import { StockQueryService } from './stock-query.service';
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('stock-ledger')
export class StockLedgerController {
  constructor(private readonly service: StockQueryService) {}
  @Get() @RequirePermission('stock_ledger', 'read') list(
    @CurrentUser() user: UserContext,
    @Query() query: InventorySearchDto,
  ) {
    return this.service.ledger(user, query);
  }
}
