import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'

export interface Warehouse extends AuditFields {
  companyId: string
  deleteYn: string
  warehouseId: string
  siteId: string | null
  name: string
}

export interface WarehousePayload {
  warehouseId?: string
  siteId?: string | null
  name: string
}

export async function getWarehouses() {
  const response = await http.get<Warehouse[]>('/warehouses')
  return response.data
}

export async function getWarehouse(warehouseId: string) {
  const response = await http.get<Warehouse>(`/warehouses/${warehouseId}`)
  return response.data
}

export async function createWarehouse(payload: WarehousePayload) {
  const response = await http.post<Warehouse>('/warehouses', payload)
  return response.data
}

export async function updateWarehouse(
  warehouseId: string,
  payload: WarehousePayload,
) {
  const response = await http.patch<Warehouse>(
    `/warehouses/${warehouseId}`,
    payload,
  )
  return response.data
}

export async function deleteWarehouse(warehouseId: string) {
  const response = await http.delete<Warehouse>(`/warehouses/${warehouseId}`)
  return response.data
}
