import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'

export interface EquipmentPayload {
  parentEquipmentId: string | null
  pmTargetYn: string
  permitTargetYn: string
  legalInspectionDate: string | null
  legalNextInspectionDate: string | null
  siteId: string
  name: string
  typeCode: string
  location: string | null
  maker: string | null
  model: string | null
  spec: string | null
  serialNo: string | null
  installDate: string | null
  deptId: string
  inspectionPeriod: number | null
  inspectionUnit: string | null
  inspectionDate: string | null
  nextInspectionDate: string | null
  legalInspectionPeriod: number | null
  legalInspectionUnit: string | null
  attachmentId: string | null
  note: string | null
}

export interface Equipment extends EquipmentPayload, AuditFields {
  companyId: string
  equipmentId: string
  deleteYn: string
}

export interface EquipmentOptions {
  sites: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  types: { value: string; label: string }[]
}

export interface EquipmentSearch {
  page: number
  siteId?: string
  deptId?: string
  parentEquipmentId?: string
  searchType?: 'equipmentId' | 'name' | 'typeCode'
  searchVal?: string
}

export async function getEquipmentList(query: EquipmentSearch) {
  return (
    await http.get<{
      items: Equipment[]
      total: number
      page: number
      limit: number
    }>('/equipment', { params: query })
  ).data
}

export async function getEquipment(id: string) {
  return (await http.get<Equipment>(`/equipment/${encodeURIComponent(id)}`))
    .data
}

export async function getEquipmentOptions() {
  return (await http.get<EquipmentOptions>('/equipment/options')).data
}

export async function createEquipment(
  equipmentId: string,
  payload: EquipmentPayload,
) {
  return (await http.post<Equipment>('/equipment', { equipmentId, ...payload }))
    .data
}

export async function updateEquipment(id: string, payload: EquipmentPayload) {
  return (
    await http.patch<Equipment>(`/equipment/${encodeURIComponent(id)}`, payload)
  ).data
}

export async function deleteEquipment(id: string) {
  return (await http.delete<Equipment>(`/equipment/${encodeURIComponent(id)}`))
    .data
}

export async function getEquipmentTree(siteId?: string) {
  return (
    await http.get<Equipment[]>('/equipment/tree', {
      params: { siteId: siteId || undefined },
    })
  ).data
}
