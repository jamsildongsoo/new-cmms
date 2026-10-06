import { DocumentStatus } from '../../common/constants/document-status';
import { ApprovalStepType } from '../entities/approval-step.entity';

export interface ApprovalStepResponseDto {
  companyId: string;
  approvalId: string;
  stepNo: number;
  type: ApprovalStepType;
  userId: string;
  status: string | null;
  comment: string | null;
  actedAt: Date | null;
}

export interface ApprovalResponseDto {
  companyId: string;
  approvalId: string;
  refModule: string | null;
  refNo: string | null;
  title: string;
  contentJson: unknown;
  submitterId: string;
  status: DocumentStatus;
  attachmentId: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  note: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
  steps: ApprovalStepResponseDto[];
}
