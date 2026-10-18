import type { RouteObject } from 'react-router-dom'
import { SiteFormPage } from './SiteFormPage'
import { SiteListPage } from './SiteListPage'

export const sitesRoutes: RouteObject[] = [
  { path: 'sites', element: <SiteListPage /> },
  { path: 'sites/new', element: <SiteFormPage mode="create" /> },
  { path: 'sites/:siteId', element: <SiteFormPage mode="view" /> },
  { path: 'sites/:siteId/edit', element: <SiteFormPage mode="edit" /> },
]
