import { http } from './http'

export type ApprovalBox =
  | 'submit'
  | 'pending'
  | 'processed'
  | 'closed'
  | 'reference'

export type ApprovalStatus = 'D' | 'P' | 'C' | 'R' | 'X'
export type ApprovalStepType = 'SUBMITTER' | 'APPROVER' | 'REFERENCE'

export interface ApprovalStep {
  companyId: string
  approvalId: string
  stepNo: number
  type: ApprovalStepType
  userId: string
  status: string | null
  comment: string | null
  actedAt: string | null
}

export interface Approval {
  companyId: string
  approvalId: string
  refModule: string | null
  refNo: string | null
  title: string
  contentJson: unknown
  submitterId: string
  status: ApprovalStatus
  attachmentId: string | null
  submittedAt: string | null
  completedAt: string | null
  note: string | null
  deleteYn: string
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
  steps: ApprovalStep[]
}

export interface ApprovalStepPayload {
  type: Exclude<ApprovalStepType, 'SUBMITTER'>
  userId: string
}

export interface ApprovalPayload {
  refModule?: string | null
  refNo?: string | null
  title: string
  contentJson: unknown
  attachmentId?: string | null
  note?: string | null
  steps: ApprovalStepPayload[]
  submit?: boolean
}

export interface ApprovalActionPayload {
  comment?: string | null
}

export async function getApprovalBox(box: ApprovalBox) {
  const response = await http.get<Approval[]>(`/approvals/boxes/${box}`)
  return response.data
}

export async function getApproval(approvalId: string) {
  const response = await http.get<Approval>(`/approvals/${approvalId}`)
  return response.data
}

export async function createApproval(payload: ApprovalPayload) {
  const response = await http.post<Approval>('/approvals', payload)
  return response.data
}

export async function updateApproval(
  approvalId: string,
  payload: ApprovalPayload,
) {
  const response = await http.patch<Approval>(`/approvals/${approvalId}`, payload)
  return response.data
}

export async function deleteApproval(approvalId: string) {
  const response = await http.delete<Approval>(`/approvals/${approvalId}`)
  return response.data
}

export async function submitApproval(approvalId: string) {
  const response = await http.post<Approval>(`/approvals/${approvalId}/submit`)
  return response.data
}

export async function approveApproval(
  approvalId: string,
  payload: ApprovalActionPayload,
) {
  const response = await http.post<Approval>(
    `/approvals/${approvalId}/approve`,
    payload,
  )
  return response.data
}

export async function rejectApproval(
  approvalId: string,
  payload: ApprovalActionPayload,
) {
  const response = await http.post<Approval>(
    `/approvals/${approvalId}/reject`,
    payload,
  )
  return response.data
}

export async function cancelApproval(approvalId: string) {
  const response = await http.post<Approval>(`/approvals/${approvalId}/cancel`)
  return response.data
}
