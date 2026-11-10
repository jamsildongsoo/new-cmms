import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';
import { StockModule } from '../stock/stock.module';
import { MonthlyClosingService } from './monthly-closing.service';
import { MonthlyClosingController } from './monthly-closing.controller';
@Module({
  imports: [TypeOrmModule.forFeature(Object.values(entities)), StockModule],
  controllers: [MonthlyClosingController],
  providers: [MonthlyClosingService],
  exports: [MonthlyClosingService],
})
export class MonthlyClosingModule {}
