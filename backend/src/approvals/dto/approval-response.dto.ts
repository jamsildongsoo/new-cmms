import { DocumentStatus } from '../../common/constants/document-status';
import { ApprovalStepType } from '../approval.constant';

export interface ApprovalUserInfoDto {
  userId: string;
  userName: string;
  deptId: string | null;
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

// API 계약: frontend/src/modules/approvals/approvals.api.ts와 함께 수정한다.
export interface ApprovalListItemDto {
  approvalId: string;
  documentNo: string;
  title: string;
  submitterId: string;
  status: DocumentStatus;
  createdAt: Date;
}

export interface ApprovalResponseDto {
  // 결재 저장은 성공했으나 원문 동기화가 실패한 경우에만 반환한다. DB에는 저장하지 않는다.
  sourceSyncWarning?: string;
  sourceAttachmentIds?: string[];
  companyId: string;
  approvalId: string;
  documentNo: string;
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
