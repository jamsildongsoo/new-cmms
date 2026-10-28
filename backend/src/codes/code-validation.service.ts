import { Injectable } from '@nestjs/common';
import { CodeItemsService } from './code-items/code-items.service';

export interface AssertValidCodeItemInput {
  companyId: string;
  codeId: string;
  codeItemId: string;
}

@Injectable()
export class CodeValidationService {
  constructor(private readonly codeItemsService: CodeItemsService) {}

  async assertValidItem(input: AssertValidCodeItemInput): Promise<void> {
    await this.codeItemsService.findActiveByIdOrThrow(
      input.companyId,
      input.codeId,
      input.codeItemId,
    );
  }
}
