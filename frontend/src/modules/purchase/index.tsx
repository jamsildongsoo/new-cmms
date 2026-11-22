import type { RouteObject } from 'react-router-dom'
import { PurchaseRequestList } from './purchase-request/PurchaseRequestList'
import { PurchaseRequestForm } from './purchase-request/PurchaseRequestForm'
import { PurchaseOrderList } from './purchase-order/PurchaseOrderList'
import { PurchaseOrderForm } from './purchase-order/PurchaseOrderForm'
export const purchaseRoutes: RouteObject[] = [
  { path: 'purchase-request', element: <PurchaseRequestList /> },
  { path: 'purchase-request/new', element: <PurchaseRequestForm /> },
  { path: 'purchase-request/:id', element: <PurchaseRequestForm /> },
  { path: 'purchase-order', element: <PurchaseOrderList /> },
  { path: 'purchase-order/new', element: <PurchaseOrderForm /> },
  { path: 'purchase-order/:id', element: <PurchaseOrderForm /> },
]
