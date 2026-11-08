import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities/inventory.entity';
import { PurchaseModule } from '../../purchase/common/purchase.module';
import { InventoryService } from './inventory.service';
import {
  InventoryController,
  StockStatusController,
  StockLedgerController,
  MonthlyClosingController,
} from './inventory.controller';
@Module({
  imports: [TypeOrmModule.forFeature(Object.values(entities)), PurchaseModule],
  controllers: [
    InventoryController,
    StockStatusController,
    StockLedgerController,
    MonthlyClosingController,
  ],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
