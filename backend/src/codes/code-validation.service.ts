import { BadRequestException, Injectable } from '@nestjs/common';
import { CodeCategoriesService } from './code-categories/code-categories.service';
import { CodeItemsService } from './code-items/code-items.service';

export interface AssertValidCodeItemInput {
  companyId: string;
  module: string;
  codeId: string;
  codeItemId: string;
}

@Injectable()
export class CodeValidationService {
  constructor(
    private readonly codeCategoriesService: CodeCategoriesService,
    private readonly codeItemsService: CodeItemsService,
  ) {}

  async assertValidItem(input: AssertValidCodeItemInput): Promise<void> {
    const category = await this.codeCategoriesService.findActiveByIdOrThrow(
      input.companyId,
      input.codeId,
    );

    if (category.module !== input.module) {
      throw new BadRequestException('Code category does not belong to module');
    }

    await this.codeItemsService.findActiveByIdOrThrow(
      input.companyId,
      input.codeId,
      input.codeItemId,
    );
  }
}
