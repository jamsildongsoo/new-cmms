// API 계약: frontend/src/modules/approvals/approval.constant.ts와 유형·결과 값을 함께 수정한다.
// 결재 결과 Y/N은 삭제 여부 Y/N과 의미가 다르다.
export const ApprovalStepType = {
  SUBMITTER: 'SUBMITTER',
  APPROVER: 'APPROVER',
  AGREE: 'AGREE',
  REFERENCE: 'REFERENCE',
} as const;
export type ApprovalStepType =
  (typeof ApprovalStepType)[keyof typeof ApprovalStepType];
export const ApprovalStepResult = { APPROVED: 'Y', REJECTED: 'N' } as const;
export type ApprovalStepResult =
  (typeof ApprovalStepResult)[keyof typeof ApprovalStepResult];
export const APPROVAL_STEP_LABELS: Record<ApprovalStepType, string> = {
  SUBMITTER: '상신',
  APPROVER: '결재',
  AGREE: '합의',
  REFERENCE: '참조',
};
