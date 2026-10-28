export type DocumentStatus = 'D' | 'P' | 'C' | 'R' | 'X'

export const documentStatusLabels: Record<DocumentStatus, string> = {
  D: 'Draft',
  P: 'In Progress',
  C: 'Confirmed',
  R: 'Rejected',
  X: 'Cancelled',
}
