import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryDocument } from './entities/inventory-document.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryControl } from './entities/inventory-control.entity';
import { StockModule } from '../stock/stock.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryDocument,
      InventoryItem,
      InventoryControl,
    ]),
    StockModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
