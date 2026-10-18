import type { RouteObject } from 'react-router-dom'
import { companyRoutes } from './companies/routes'
import { departmentsRoutes } from './departments/routes'
import { sitesRoutes } from './sites/routes'
import { warehousesRoutes } from './warehouses/routes'

export const organizationRoutes: RouteObject[] = [
  ...companyRoutes,
  ...sitesRoutes,
  ...departmentsRoutes,
  ...warehousesRoutes,
]
