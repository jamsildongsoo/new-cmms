import { http } from '@/shared/api/http'

export interface DirectoryUser {
  userId: string
  userName: string
  deptId: string | null
  deptName: string | null
  title: string | null
  position: string | null
}

export interface DirectoryDepartment {
  deptId: string
  deptName: string
}

export interface DirectoryEquipment {
  equipmentId: string
  name: string
  siteId: string
}

export interface DirectoryMaterial {
  materialId: string
  name: string
}

export async function searchDirectoryUsers(query: string) {
  const response = await http.get<DirectoryUser[]>('/directory/users', {
    params: { q: query },
  })
  return response.data
}

export async function searchDirectoryDepartments(query: string) {
  const response = await http.get<DirectoryDepartment[]>('/directory/departments', {
    params: { q: query },
  })
  return response.data
}

export async function searchDirectoryEquipment(query: string) {
  return (await http.get<DirectoryEquipment[]>('/directory/equipment', { params: { q: query } })).data
}

export async function searchDirectoryMaterials(query: string) {
  return (await http.get<DirectoryMaterial[]>('/directory/materials', { params: { q: query } })).data
}
