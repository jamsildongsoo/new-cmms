export { isInspectionOverdue } from './equipmentForm'
import type { RouteObject } from 'react-router-dom'
import { EquipmentFormPage } from './EquipmentFormPage'
import { EquipmentListPage } from './EquipmentListPage'

export const equipmentRoutes: RouteObject[] = [
  { path: 'equipment', element: <EquipmentListPage /> },
  { path: 'equipment/new', element: <EquipmentFormPage mode="create" /> },
  {
    path: 'equipment/:equipmentId',
    element: <EquipmentFormPage mode="view" />,
  },
  {
    path: 'equipment/:equipmentId/edit',
    element: <EquipmentFormPage mode="edit" />,
  },
]
