import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';
import { InventoryDocument, InventoryItem } from '../transactions/entities';
import { StockProcessingService } from './stock-processing.service';
import { StockQueryService } from './stock-query.service';
import { StockStatusController } from './stock-status.controller';
import { StockLedgerController } from './stock-ledger.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...Object.values(entities),
      InventoryDocument,
      InventoryItem,
    ]),
  ],
  controllers: [StockStatusController, StockLedgerController],
  providers: [StockProcessingService, StockQueryService],
  exports: [StockProcessingService, StockQueryService],
})
export class StockModule {}
