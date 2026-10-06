import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeCategoriesController } from './code-categories/code-categories.controller';
import { CodeCategoriesService } from './code-categories/code-categories.service';
import { CodeCategoryEntity } from './code-categories/entities/code-category.entity';
import { CodeItemsController } from './code-items/code-items.controller';
import { CodeItemsService } from './code-items/code-items.service';
import { CodeItem } from './code-items/entities/code-item.entity';
import { CodeValidationService } from './code-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([CodeCategoryEntity, CodeItem])],
  controllers: [CodeCategoriesController, CodeItemsController],
  providers: [CodeCategoriesService, CodeItemsService, CodeValidationService],
  exports: [CodeValidationService],
})
export class CodesModule {}
