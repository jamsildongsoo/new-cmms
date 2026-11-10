import type { RouteObject } from 'react-router-dom'
import {
  PurchaseRequestList,
  PurchaseRequestForm,
} from './purchase-request/PurchaseRequestPages'
import {
  PurchaseOrderList,
  PurchaseOrderForm,
} from './purchase-order/PurchaseOrderPages'
export const purchaseRoutes: RouteObject[] = [
  { path: 'purchase-request', element: <PurchaseRequestList /> },
  { path: 'purchase-request/new', element: <PurchaseRequestForm /> },
  { path: 'purchase-request/:id', element: <PurchaseRequestForm /> },
  { path: 'purchase-order', element: <PurchaseOrderList /> },
  { path: 'purchase-order/new', element: <PurchaseOrderForm /> },
  { path: 'purchase-order/:id', element: <PurchaseOrderForm /> },
]
