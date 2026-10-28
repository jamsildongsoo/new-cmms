import { DocumentStatus } from '../../common/constants/document-status';
import { ApprovalStepType } from '../entities/approval-step.entity';

export interface ApprovalUserInfoDto {
  userId: string;
  userName: string;
  deptId: string;
  deptName: string | null;
  title: string | null;
  position: string | null;
}

export interface ApprovalStepResponseDto {
  userName: string | null;
  deptId: string | null;
  deptName: string | null;
  title: string | null;
  position: string | null;
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
  refId: string | null;
  title: string;
  contentJson: unknown;
  submitterId: string;
  status: DocumentStatus;
  attachmentId: string | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
  steps: ApprovalStepResponseDto[];
}
