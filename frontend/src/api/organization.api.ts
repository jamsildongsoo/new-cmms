import type { AuditFields } from '../types/audit'
import { http } from './http'

export interface Site extends AuditFields {
  companyId: string
  deleteYn: string
  siteId: string
  name: string
}

export interface Department extends AuditFields {
  companyId: string
  deleteYn: string
  deptId: string
  siteId: string | null
  name: string
  parentDeptId: string | null
}

export interface Warehouse extends AuditFields {
  companyId: string
  deleteYn: string
  warehouseId: string
  siteId: string | null
  name: string
}

export interface SitePayload {
  siteId?: string
  name: string
}

export interface DepartmentPayload {
  deptId?: string
  siteId?: string | null
  name: string
  parentDeptId?: string | null
}

export interface WarehousePayload {
  warehouseId?: string
  siteId?: string | null
  name: string
}

export async function getSites() {
  const response = await http.get<Site[]>('/sites')
  return response.data
}

export async function createSite(payload: SitePayload) {
  const response = await http.post<Site>('/sites', payload)
  return response.data
}

export async function updateSite(siteId: string, payload: SitePayload) {
  const response = await http.patch<Site>(`/sites/${siteId}`, payload)
  return response.data
}

export async function deleteSite(siteId: string) {
  const response = await http.delete<Site>(`/sites/${siteId}`)
  return response.data
}

export async function getDepartments() {
  const response = await http.get<Department[]>('/departments')
  return response.data
}

export async function createDepartment(payload: DepartmentPayload) {
  const response = await http.post<Department>('/departments', payload)
  return response.data
}

export async function updateDepartment(
  deptId: string,
  payload: DepartmentPayload,
) {
  const response = await http.patch<Department>(`/departments/${deptId}`, payload)
  return response.data
}

export async function deleteDepartment(deptId: string) {
  const response = await http.delete<Department>(`/departments/${deptId}`)
  return response.data
}

export async function getWarehouses() {
  const response = await http.get<Warehouse[]>('/warehouses')
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
