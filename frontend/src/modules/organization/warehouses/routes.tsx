import type { RouteObject } from 'react-router-dom'
import { WarehouseFormPage } from './WarehouseFormPage'
import { WarehouseListPage } from './WarehouseListPage'

export const warehousesRoutes: RouteObject[] = [
  { path: 'warehouses', element: <WarehouseListPage /> },
  { path: 'warehouses/new', element: <WarehouseFormPage mode="create" /> },
  { path: 'warehouses/:warehouseId', element: <WarehouseFormPage mode="view" /> },
  { path: 'warehouses/:warehouseId/edit', element: <WarehouseFormPage mode="edit" /> },
]
