import type { RouteObject } from 'react-router-dom'
import { InventoryList, InventoryForm } from './InventoryPages'
export const inventoryTransactionRoutes: RouteObject[] = [
  { path: 'inventory-document', element: <InventoryList /> },
  { path: 'inventory-document/new', element: <InventoryForm /> },
  { path: 'inventory-document/:id', element: <InventoryForm /> },
]
