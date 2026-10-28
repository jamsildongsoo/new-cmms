import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'

export interface Department extends AuditFields {
  companyId: string
  deleteYn: string
  deptId: string
  siteId: string | null
  name: string
  parentDeptId: string | null
}

export interface DepartmentPayload {
  deptId?: string
  siteId?: string | null
  name: string
  parentDeptId?: string | null
}

export async function getDepartments() {
  const response = await http.get<Department[]>('/departments')
  return response.data
}

export async function getDepartment(deptId: string) {
  const response = await http.get<Department>(`/departments/${deptId}`)
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
