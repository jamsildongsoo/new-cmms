import type { RouteObject } from 'react-router-dom'
import { ApprovalFormPage } from './ApprovalFormPage'
import { ApprovalListPage } from './ApprovalListPage'

export const approvalRoutes: RouteObject[] = [
  { path: 'approvals', element: <ApprovalListPage /> },
  { path: 'approvals/new', element: <ApprovalFormPage mode="create" /> },
  { path: 'approvals/:approvalId', element: <ApprovalFormPage mode="view" /> },
  {
    path: 'approvals/:approvalId/edit',
    element: <ApprovalFormPage mode="edit" />,
  },
]
