export const DocumentStatus = {
  DRAFT: 'D',
  PROGRESS: 'P',
  CONFIRMED: 'C',
  REJECTED: 'R',
  CANCELLED: 'X',
} as const;

export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];
