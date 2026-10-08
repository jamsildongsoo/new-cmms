import {
  createDepartment,
  deleteDepartment,
  getDepartments,
  updateDepartment,
  type Department,
  type DepartmentPayload,
} from '../api/organization.api'
import { MasterPage } from './MasterPage'

export function DepartmentsPage() {
  return (
    <MasterPage<Department, DepartmentPayload>
      title="Departments"
      subtitle="Departments and parent department relationships"
      permissionPrefix="department"
      idLabel="department"
      getId={(row) => row.deptId}
      emptyForm={{ deptId: '', siteId: '', name: '', parentDeptId: '' }}
      fields={[
        { key: 'deptId', label: 'Department ID', required: true, disabledOnEdit: true },
        { key: 'name', label: 'Name', required: true },
        { key: 'siteId', label: 'Site ID' },
        { key: 'parentDeptId', label: 'Parent Department ID' },
      ]}
      columns={[
        { key: 'deptId', label: 'Department ID', render: (row) => row.deptId },
        { key: 'name', label: 'Name', render: (row) => row.name },
        { key: 'siteId', label: 'Site ID', render: (row) => row.siteId ?? '-' },
        {
          key: 'parentDeptId',
          label: 'Parent',
          render: (row) => row.parentDeptId ?? '-',
        },
      ]}
      toForm={(row) => ({
        deptId: row.deptId,
        siteId: row.siteId ?? '',
        name: row.name,
        parentDeptId: row.parentDeptId ?? '',
      })}
      loadRows={getDepartments}
      createRow={createDepartment}
      updateRow={updateDepartment}
      deleteRow={deleteDepartment}
    />
  )
}
