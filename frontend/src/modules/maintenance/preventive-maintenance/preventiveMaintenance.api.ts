import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/types/document'
import { http } from '@/shared/api/http'

export const PM_MODULE = 'preventive_maintenance'

export interface InspectionItem {
  name: string
  standardValue: string
  inspectionValue: string
  unit: string
}

export interface PMOptions {
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
  pmId: string
  documentNo: string
  title: string
  equipmentId: string
  result: 'OK' | 'NOK' | null
  inspectionDeptId: string | null
  inspectorId: string | null
  inspectionDeptName?: string | null
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
  inspectionDeptId?: string | null
  inspectorId?: string | null
  inspectionDate?: string | null
  nextInspectionDate?: string | null
  items?: InspectionItem[]
  typeCode?: string | null
  content?: string | null
  attachmentId?: string | null
  note?: string | null
}

export async function getPreventiveMaintenanceList() {
  const response = await http.get<PreventiveMaintenance[]>(
    '/preventive-maintenance',
  )
  return response.data
}

export async function getPreventiveMaintenance(pmId: string) {
  const response = await http.get<PreventiveMaintenance>(
    `/preventive-maintenance/${pmId}`,
  )
  return response.data
}

export async function createPreventiveMaintenance(
  requestKey: string,
  payload: PreventiveMaintenancePayload,
) {
  const response = await http.post<PreventiveMaintenance>(
    '/preventive-maintenance',
    payload,
    { headers: { 'Idempotency-Key': requestKey } },
  )
  return response.data
}

export async function updatePreventiveMaintenance(
  pmId: string,
  payload: PreventiveMaintenancePayload,
) {
  const response = await http.patch<PreventiveMaintenance>(
    `/preventive-maintenance/${pmId}`,
    payload,
  )
  return response.data
}

export async function deletePreventiveMaintenance(pmId: string) {
  const response = await http.delete<PreventiveMaintenance>(
    `/preventive-maintenance/${pmId}`,
  )
  return response.data
}
