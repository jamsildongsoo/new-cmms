import type { RouteObject } from 'react-router-dom'
import { StockReport } from './StockReport'
export const stockRoutes: RouteObject[] = [
  { path: 'stock-status', element: <StockReport /> },
  { path: 'stock-ledger', element: <StockReport ledger /> },
]
