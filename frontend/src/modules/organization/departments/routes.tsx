import type { RouteObject } from 'react-router-dom'
import { DepartmentFormPage } from './DepartmentFormPage'
import { DepartmentListPage } from './DepartmentListPage'

export const departmentsRoutes: RouteObject[] = [
  { path: 'departments', element: <DepartmentListPage /> },
  { path: 'departments/new', element: <DepartmentFormPage mode="create" /> },
  { path: 'departments/:deptId', element: <DepartmentFormPage mode="view" /> },
  { path: 'departments/:deptId/edit', element: <DepartmentFormPage mode="edit" /> },
]
