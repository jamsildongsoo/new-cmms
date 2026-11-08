import type { RouteObject } from 'react-router-dom'
import {
  InventoryList,
  InventoryForm,
  StockReport,
  MonthlyClosing,
} from './InventoryPages'
export const inventoryRoutes: RouteObject[] = [
  { path: 'inventory-document', element: <InventoryList /> },
  { path: 'inventory-document/new', element: <InventoryForm /> },
  { path: 'inventory-document/:id', element: <InventoryForm /> },
  { path: 'stock-status', element: <StockReport /> },
  { path: 'stock-ledger', element: <StockReport ledger /> },
  { path: 'monthly-closing', element: <MonthlyClosing /> },
]
