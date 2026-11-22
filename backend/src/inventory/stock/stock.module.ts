import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockBalance } from './entities/stock-balance.entity';
import { InventoryDocument } from '../transactions/entities/inventory-document.entity';
import { InventoryItem } from '../transactions/entities/inventory-item.entity';
import { StockProcessingService } from './stock-processing.service';
import { StockQueryService } from './stock-query.service';
import { StockStatusController } from './stock-status.controller';
import { StockLedgerController } from './stock-ledger.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([StockBalance, InventoryDocument, InventoryItem]),
  ],
  controllers: [StockStatusController, StockLedgerController],
  providers: [StockProcessingService, StockQueryService],
  exports: [StockProcessingService, StockQueryService],
})
export class StockModule {}
