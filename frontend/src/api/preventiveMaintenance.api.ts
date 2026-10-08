import type { AuditFields } from '../types/audit'
import type { DocumentStatus } from '../types/document'
import { http } from './http'

export const PM_MODULE = 'preventive_maintenance'

export interface PreventiveMaintenance extends AuditFields {
  companyId: string
  pmId: string
  documentNo: string
  title: string
  equipmentId: string
  plannedDate: string | null
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
  plannedDate?: string | null
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
  pmId: string,
  payload: PreventiveMaintenancePayload,
) {
  const response = await http.post<PreventiveMaintenance>(
    '/preventive-maintenance',
    { pmId, ...payload },
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
