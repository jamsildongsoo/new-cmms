import type { RouteObject } from 'react-router-dom'
import { InventoryList } from './InventoryList'
import { InventoryForm } from './InventoryForm'
import { inventoryMenus, type InventoryMenu } from './inventory.navigation'
export const inventoryTransactionRoutes: RouteObject[] = [
  ...Object.entries(inventoryMenus).flatMap(([mode, menu]) => [
    {
      path: menu.path.slice(1),
      element: <InventoryList key={mode} mode={mode as InventoryMenu} />,
    },
    {
      path: `${menu.path.slice(1)}/new`,
      element: <InventoryForm mode={mode as InventoryMenu} />,
    },
  ]),
  { path: 'inventory-document/:id', element: <InventoryForm /> },
]
