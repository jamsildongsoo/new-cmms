import { inventoryTransactionRoutes } from './transactions'
import { stockRoutes } from './stock'
import { monthlyClosingRoutes } from './monthly-closing'
export const inventoryRoutes = [
  ...inventoryTransactionRoutes,
  ...stockRoutes,
  ...monthlyClosingRoutes,
]
