import type { RouteObject } from 'react-router-dom'
import { PurchaseForm, PurchaseList } from './PurchasePages'
export const purchaseRoutes: RouteObject[] = [
  { path: 'purchase-request', element: <PurchaseList kind="request" /> },
  { path: 'purchase-request/new', element: <PurchaseForm kind="request" /> },
  { path: 'purchase-request/:id', element: <PurchaseForm kind="request" /> },
  { path: 'purchase-order', element: <PurchaseList kind="order" /> },
  { path: 'purchase-order/new', element: <PurchaseForm kind="order" /> },
  { path: 'purchase-order/:id', element: <PurchaseForm kind="order" /> },
]
