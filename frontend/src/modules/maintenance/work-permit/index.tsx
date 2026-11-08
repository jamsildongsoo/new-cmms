import type { RouteObject } from 'react-router-dom'
import { PermitForm, PermitList } from './PermitPages'
export const permitRoutes: RouteObject[] = [
  { path: 'work-permit-request', element: <PermitList request /> },
  { path: 'work-permit-request/new', element: <PermitForm request /> },
  { path: 'work-permit-request/:id', element: <PermitForm request /> },
  { path: 'work-permit', element: <PermitList /> },
  { path: 'work-permit/new', element: <PermitForm /> },
  { path: 'work-permit/:id', element: <PermitForm /> },
]
