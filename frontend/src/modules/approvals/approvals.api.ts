import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/types/document'
import { http } from '@/shared/api/http'

export type ApprovalBox =
  'submit' | 'pending' | 'processed' | 'closed' | 'reference'

export type ApprovalStepType = 'SUBMITTER' | 'APPROVER' | 'AGREE' | 'REFERENCE'

export interface ApprovalStep {
  companyId: string
  approvalId: string
  stepNo: number
  type: ApprovalStepType
  userId: string
  userName: string | null
  deptId: string | null
  deptName: string | null
  title: string | null
  position: string | null
  status: string | null
  comment: string | null
  actedAt: string | null
}

export interface Approval extends AuditFields {
  companyId: string
  approvalId: string
  refModule: string | null
  refId: string | null
  title: string
  contentJson: unknown
  submitterId: string
  status: DocumentStatus
  attachmentId: string | null
  submittedAt: string | null
  completedAt: string | null
  deleteYn: string
  steps: ApprovalStep[]
}

export interface ApprovalStepPayload {
  type: Exclude<ApprovalStepType, 'SUBMITTER'>
  userId: string
}

export interface ApprovalPayload {
  refModule?: string | null
  refId?: string | null
  title: string
  contentJson: unknown
  attachmentId?: string | null
  steps: ApprovalStepPayload[]
  submit?: boolean
}

export interface ApprovalCreatePayload extends ApprovalPayload {
  approvalId?: string
}

export interface ApprovalUserInfo {
  userId: string
  userName: string
  deptId: string
  deptName: string | null
  title: string | null
  position: string | null
}

export async function searchApprovalUsers(query: string) {
  const response = await http.get<ApprovalUserInfo[]>('/approvals/users', {
    params: { q: query },
  })
  return response.data
}

export async function getApprovalUser(userId: string) {
  const response = await http.get<ApprovalUserInfo>(
    `/approvals/users/${encodeURIComponent(userId)}`,
  )
  return response.data
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

export async function createApproval(payload: ApprovalCreatePayload) {
  const response = await http.post<Approval>('/approvals', payload)
  return response.data
}

export async function updateApproval(
  approvalId: string,
  payload: ApprovalPayload,
) {
  const response = await http.patch<Approval>(
    `/approvals/${approvalId}`,
    payload,
  )
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
