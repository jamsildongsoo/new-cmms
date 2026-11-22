import { Attachment } from '../attachments/entities/attachment.entity';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberSequence } from './entities/number-sequence.entity';
import { NumberingService } from './numbering.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([NumberSequence, Attachment]),
  ],
  providers: [NumberingService],
  exports: [NumberingService],
})
export class NumberingModule {}
