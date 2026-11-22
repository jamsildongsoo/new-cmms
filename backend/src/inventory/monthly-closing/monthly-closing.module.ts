import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryPeriodLock } from './entities/inventory-period-lock.entity';
import { StockModule } from '../stock/stock.module';
import { MonthlyClosingService } from './monthly-closing.service';
import { MonthlyClosingController } from './monthly-closing.controller';
@Module({
  imports: [TypeOrmModule.forFeature([InventoryPeriodLock]), StockModule],
  controllers: [MonthlyClosingController],
  providers: [MonthlyClosingService],
  exports: [MonthlyClosingService],
})
export class MonthlyClosingModule {}
