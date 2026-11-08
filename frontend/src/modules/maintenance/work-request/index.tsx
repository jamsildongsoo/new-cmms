import type { RouteObject } from 'react-router-dom'
import { WorkRequestFormPage } from './WorkRequestFormPage'
import { WorkRequestListPage } from './WorkRequestListPage'
export { getWorkRequest } from './workRequest.api'
export type { WorkRequest } from './workRequest.api'
export const workRequestRoutes: RouteObject[] = [
  { path: 'work-request', element: <WorkRequestListPage /> },
  { path: 'work-request/new', element: <WorkRequestFormPage mode="create" /> },
  {
    path: 'work-request/:workRequestId',
    element: <WorkRequestFormPage mode="view" />,
  },
  {
    path: 'work-request/:workRequestId/edit',
    element: <WorkRequestFormPage mode="edit" />,
  },
]
