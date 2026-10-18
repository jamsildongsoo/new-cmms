import type { RouteObject } from 'react-router-dom'
import { PreventiveMaintenanceFormPage } from './PreventiveMaintenanceFormPage'
import { PreventiveMaintenanceListPage } from './PreventiveMaintenanceListPage'

export const preventiveMaintenanceRoutes: RouteObject[] = [
  { path: 'preventive-maintenance', element: <PreventiveMaintenanceListPage /> },
  {
    path: 'preventive-maintenance/new',
    element: <PreventiveMaintenanceFormPage mode="create" />,
  },
  {
    path: 'preventive-maintenance/:pmId',
    element: <PreventiveMaintenanceFormPage mode="view" />,
  },
  {
    path: 'preventive-maintenance/:pmId/edit',
    element: <PreventiveMaintenanceFormPage mode="edit" />,
  },
]
