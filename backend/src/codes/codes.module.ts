import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeItemsController } from './code-items/code-items.controller';
import { CodeItemsService } from './code-items/code-items.service';
import { CodeItem } from './code-items/entities/code-item.entity';
import { CodeValidationService } from './code-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([CodeItem])],
  controllers: [CodeItemsController],
  providers: [CodeItemsService, CodeValidationService],
  exports: [CodeValidationService],
})
export class CodesModule {}
