import { ConflictException } from '@nestjs/common';
import { DocumentStatus } from '../constants/document-status';

export function assertDraft(status: DocumentStatus): void {
  if (status !== DocumentStatus.DRAFT) {
    throw new ConflictException('Only draft documents can be changed');
  }
}
