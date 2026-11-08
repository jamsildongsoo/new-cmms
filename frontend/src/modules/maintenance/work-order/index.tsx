import type { RouteObject } from 'react-router-dom'
import { WorkOrderListPage } from './WorkOrderListPage'
import { WorkOrderFormPage } from './WorkOrderFormPage'
export const workOrderRoutes: RouteObject[] = [
  { path: 'work-order', element: <WorkOrderListPage /> },
  { path: 'work-order/new', element: <WorkOrderFormPage mode="create" /> },
  {
    path: 'work-order/:workOrderId',
    element: <WorkOrderFormPage mode="view" />,
  },
  {
    path: 'work-order/:workOrderId/edit',
    element: <WorkOrderFormPage mode="edit" />,
  },
]
