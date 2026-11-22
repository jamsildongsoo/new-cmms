export const DocumentStatus = {
  DRAFT: 'D',
  PROGRESS: 'P',
  CONFIRMED: 'C',
  REJECTED: 'R',
  CANCELLED: 'X',
} as const;

export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  D: '작성 중',
  P: '결재 중',
  C: '완결',
  R: '반려',
  X: '취소',
};
