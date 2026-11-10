import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';
import { PurchaseOrderModule } from '../../purchase/purchase-order/purchase-order.module';
import { StockModule } from '../stock/stock.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature(Object.values(entities)),
    PurchaseOrderModule,
    StockModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
