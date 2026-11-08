import type { RouteObject } from 'react-router-dom'
import { VendorListPage, VendorFormPage } from './VendorPages'
export const vendorRoutes: RouteObject[] = [
  { path: 'vendor', element: <VendorListPage /> },
  { path: 'vendor/new', element: <VendorFormPage /> },
  { path: 'vendor/:vendorId', element: <VendorFormPage /> },
]
