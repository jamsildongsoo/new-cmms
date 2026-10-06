import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberSequence } from './entities/number-sequence.entity';
import { NumberingService } from './numbering.service';

@Module({
  imports: [TypeOrmModule.forFeature([NumberSequence])],
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
