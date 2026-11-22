import { http } from '@/shared/api/http'

export type Resource = 'users' | 'roles'
export type IdentityRow = Record<string, string | boolean | null>
export interface Choice {
  id: string
  name: string
}
export interface UserOptions {
  sites: Choice[]
  departments: Choice[]
  roles: Choice[]
}

export async function listRecords(resource: Resource) {
  return (await http.get<IdentityRow[]>(`/${resource}`)).data
}
export async function getRecord(resource: Resource, id: string) {
  return (await http.get<IdentityRow>(`/${resource}/${encodeURIComponent(id)}`))
    .data
}
export async function createRecord(
  resource: Resource,
  payload: Record<string, string | null>,
) {
  return (await http.post<IdentityRow>(`/${resource}`, payload)).data
}
export async function updateRecord(
  resource: Resource,
  id: string,
  payload: Record<string, string | null>,
) {
  return (
    await http.patch<IdentityRow>(
      `/${resource}/${encodeURIComponent(id)}`,
      payload,
    )
  ).data
}
export async function deleteRecord(resource: Resource, id: string) {
  return (await http.delete(`/${resource}/${encodeURIComponent(id)}`)).data
}
export async function getUserOptions() {
  return (await http.get<UserOptions>('/users/options')).data
}
export async function getRolePermissions(roleId: string) {
  return (
    await http.get<string[]>(`/roles/${encodeURIComponent(roleId)}/permissions`)
  ).data
}
export interface PermissionOption {
  permissionId: string
  module: string
  moduleLabel: string
  action: string
  name: string
}
export async function getRolePermissionOptions() {
  return (await http.get<PermissionOption[]>('/roles/permission-options')).data
}
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[],
) {
  return (
    await http.put<string[]>(
      `/roles/${encodeURIComponent(roleId)}/permissions`,
      { permissionIds },
    )
  ).data
}
