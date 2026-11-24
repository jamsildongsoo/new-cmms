import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/constants/document-status'
export interface WorkRequestPayload {
  documentNo: string
  title: string
  equipmentId: string
  occurredDate: string
  content: string
  // 참고값: priority.ts에서 선택하며 백엔드 허용값 검증은 하지 않는다.
  priorityCode: string | null
  attachmentId: string | null
  note: string | null
}
export interface WorkRequest extends WorkRequestPayload, AuditFields {
  companyId: string
  workRequestId: string
  requesterId: string
  siteId: string | null
  deptId: string | null
  status: DocumentStatus
  deleteYn: string
}
export interface WorkRequestOptions {
  sites: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  users: { value: string; label: string }[]
  equipment: { value: string; label: string }[]
  siteId: string | null
  deptId: string | null
}
export interface RelatedPlan {
  workOrderId: string
  documentNo: string
  title: string
  workDate: string
  status: DocumentStatus
}
// API 계약: backend/src/maintenance/work-request의 목록 DTO·응답과 함께 수정한다.
export interface WorkRequestSearch {
  page?: number
  search?: string
  searchType?: 'id' | 'documentNo' | 'title' | 'equipmentId' | 'createdBy'
}
export type WorkRequestListItem = Pick<
  WorkRequest,
  | 'workRequestId'
  | 'documentNo'
  | 'title'
  | 'equipmentId'
  | 'occurredDate'
  | 'priorityCode'
  | 'status'
>
export interface WorkRequestPage {
  items: WorkRequestListItem[]
  total: number
  page: number
  limit: number
}
export async function getWorkRequests(params: WorkRequestSearch = {}) {
  return (await http.get<WorkRequestPage>('/work-request', { params })).data
}
export async function getWorkRequest(id: string) {
  return (
    await http.get<WorkRequest>(`/work-request/${encodeURIComponent(id)}`)
  ).data
}
export async function getWorkRequestOptions() {
  return (await http.get<WorkRequestOptions>('/work-request/options')).data
}
export async function getRelatedPlans(id: string) {
  return (
    await http.get<RelatedPlan[]>(
      `/work-request/${encodeURIComponent(id)}/plans`,
    )
  ).data
}
export async function createWorkRequest(payload: WorkRequestPayload) {
  return (await http.post<WorkRequest>('/work-request', payload)).data
}

export async function updateWorkRequest(
  id: string,
  payload: WorkRequestPayload,
) {
  return (
    await http.patch<WorkRequest>(
      `/work-request/${encodeURIComponent(id)}`,
      payload,
    )
  ).data
}
export async function deleteWorkRequest(id: string) {
  return (
    await http.delete<WorkRequest>(`/work-request/${encodeURIComponent(id)}`)
  ).data
}
