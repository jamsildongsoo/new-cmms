import type { Resource } from './identity.api'

export interface IdentityField {
  key: string
  label: string
  required?: boolean
  type?: 'password' | 'email'
}
export const configs: Record<
  Resource,
  { title: string; permission: string; idKey: string; fields: IdentityField[] }
> = {
  users: {
    title: 'Users',
    permission: 'user',
    idKey: 'userId',
    fields: [
      { key: 'userId', label: 'User ID', required: true },
      { key: 'name', label: 'Name', required: true },
      {
        key: 'password',
        label: 'Password (leave blank to keep current)',
        type: 'password',
      },
      { key: 'siteId', label: 'Site', required: true },
      { key: 'deptId', label: 'Department', required: true },
      { key: 'roleId', label: 'Role', required: true },
      { key: 'accessScope', label: 'Access Scope', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phoneNumber', label: 'Phone Number' },
      { key: 'title', label: 'Title' },
      { key: 'position', label: 'Position' },
    ],
  },
  roles: {
    title: 'Roles',
    permission: 'role',
    idKey: 'roleId',
    fields: [
      { key: 'roleId', label: 'Role ID', required: true },
      { key: 'name', label: 'Name', required: true },
    ],
  },
  permissions: {
    title: 'Permissions',
    permission: 'permission',
    idKey: 'permissionId',
    fields: [
      { key: 'permissionId', label: 'Permission ID', required: true },
      { key: 'module', label: 'Module', required: true },
      { key: 'action', label: 'Action', required: true },
      { key: 'name', label: 'Name', required: true },
    ],
  },
}
