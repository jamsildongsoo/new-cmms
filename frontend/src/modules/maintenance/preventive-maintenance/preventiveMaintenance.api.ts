// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/constants/document-status'
import { http } from '@/shared/api/http'

export const PM_MODULE = 'PMAINT'

export interface InspectionItem {
  name: string
  standardValue: string
  inspectionValue: string
  unit: string
}

export interface PMOptions {
  sites: { value: string; label: string }[]
  // 백엔드 해당 업무 options API의 units(공통코드 UNIT)와 함께 수정한다.
  units: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  users: { value: string; label: string }[]
  equipment: {
    equipmentId: string
    name: string
    inspectionPeriod: number | null
    inspectionUnit: string | null
  }[]
  types: { value: string; label: string }[]
}

export async function getPMOptions() {
  return (await http.get<PMOptions>('/preventive-maintenance/options')).data
}

export interface PreventiveMaintenance extends AuditFields {
  companyId: string
  // 백엔드 PM 엔티티의 문서 소속. deptId는 화면에서 점검부서로 표시한다.
  siteId: string | null
  pmId: string
  documentNo: string
  title: string
  equipmentId: string
  result: 'OK' | 'NOK' | null
  deptId: string | null
  inspectorId: string | null
  deptName?: string | null
  inspectorName?: string | null
  inspectionDate: string | null
  nextInspectionDate: string | null
  items: InspectionItem[]
  typeCode: string | null
  content: string | null
  requesterId: string
  status: DocumentStatus
  attachmentId: string | null
  note: string | null
  deleteYn: string
}

export interface PreventiveMaintenancePayload {
  documentNo: string
  title: string
  equipmentId: string
  result?: 'OK' | 'NOK' | null
  deptId?: string | null
  inspectorId?: string | null
  inspectionDate: string
  nextInspectionDate?: string | null
  items?: InspectionItem[]
  typeCode?: string | null
  content?: string | null
  attachmentId?: string | null
  note?: string | null
}

// API 계약: backend/src/maintenance/preventive-maintenance의 목록 DTO·select와 함께 수정한다.
export type PMListItem = Pick<
  PreventiveMaintenance,
  | 'pmId'
  | 'documentNo'
  | 'title'
  | 'equipmentId'
  | 'inspectionDate'
  | 'nextInspectionDate'
  | 'result'
  | 'deptId'
  | 'deptName'
  | 'inspectorId'
  | 'inspectorName'
  | 'status'
>
export interface PMPage {
  items: PMListItem[]
  total: number
  page: number
  limit: number
}
export async function getPreventiveMaintenanceList(params: {
  page: number
  search?: string
  searchType?: 'pmId' | 'documentNo' | 'title' | 'equipmentId' | 'createdBy'
}) {
  return (await http.get<PMPage>('/preventive-maintenance', { params })).data
}

export async function getPreventiveMaintenance(pmId: string) {
  const response = await http.get<PreventiveMaintenance>(
    `/preventive-maintenance/${pmId}`,
  )
  return response.data
}

export async function createPreventiveMaintenance(
  payload: PreventiveMaintenancePayload,
) {
  return (
    await http.post<PreventiveMaintenance>('/preventive-maintenance', payload)
  ).data
}

export async function updatePreventiveMaintenance(
  pmId: string,
  payload: PreventiveMaintenancePayload,
) {
  return (
    await http.patch<PreventiveMaintenance>(
      `/preventive-maintenance/${pmId}`,
      payload,
    )
  ).data
}

export async function deletePreventiveMaintenance(pmId: string) {
  const response = await http.delete<PreventiveMaintenance>(
    `/preventive-maintenance/${pmId}`,
  )
  return response.data
}
