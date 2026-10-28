import type { RouteObject } from 'react-router-dom'
import { CompaniesPage } from './CompaniesPage'

export const companyRoutes: RouteObject[] = [
  { path: 'companies', element: <CompaniesPage /> },
]
