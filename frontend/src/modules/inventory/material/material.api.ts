import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
export interface MaterialPayload {
  name: string
  typeCode: string
  baseUnit: string
  spec: string | null
  maker: string | null
  model: string | null
  note: string | null
  attachmentId: string | null
}
export interface Material extends MaterialPayload, AuditFields {
  companyId: string
  materialId: string
  deleteYn: string
}
export interface MaterialOptions {
  types: { value: string; label: string }[]
}
export interface MaterialSearch {
  page: number
  searchType?: 'materialId' | 'name' | 'typeCode'
  searchVal?: string
}
export async function getMaterialList(query: MaterialSearch) {
  return (
    await http.get<{
      items: Material[]
      page: number
      limit: number
      total: number
    }>('/material', { params: query })
  ).data
}
export async function getMaterial(id: string) {
  return (await http.get<Material>(`/material/${encodeURIComponent(id)}`)).data
}
export async function getMaterialOptions() {
  return (await http.get<MaterialOptions>('/material/options')).data
}
export async function createMaterial(
  materialId: string,
  payload: MaterialPayload,
) {
  return (await http.post<Material>('/material', { materialId, ...payload }))
    .data
}
export async function updateMaterial(id: string, payload: MaterialPayload) {
  return (
    await http.patch<Material>(`/material/${encodeURIComponent(id)}`, payload)
  ).data
}
export async function deleteMaterial(id: string) {
  return (await http.delete<Material>(`/material/${encodeURIComponent(id)}`))
    .data
}
