import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/types/document'
export interface WorkRequestPayload {
  documentNo: string
  title: string
  equipmentId: string
  occurredDate: string
  content: string
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
  equipment: { value: string; label: string }[]
  priorities: { value: string; label: string }[]
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
export interface WorkRequestSearch {
  status?: DocumentStatus
  priorityCode?: string
  searchType?: 'title' | 'documentNo' | 'equipmentId'
  searchVal?: string
  occurredDateFrom?: string
  occurredDateTo?: string
}
export async function getWorkRequests(params: WorkRequestSearch = {}) {
  return (await http.get<WorkRequest[]>('/work-request', { params })).data
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
export async function createWorkRequest(
  requestKey: string,
  payload: WorkRequestPayload,
) {
  return (
    await http.post<WorkRequest>('/work-request', payload, {
      headers: { 'Idempotency-Key': requestKey },
    })
  ).data
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
