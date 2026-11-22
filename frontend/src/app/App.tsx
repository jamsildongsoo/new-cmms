import { boardRoutes } from '@/modules/boards'
import { purchaseRoutes } from '@/modules/purchase'
import { vendorRoutes } from '@/modules/purchase/vendor'
import { inventoryRoutes } from '@/modules/inventory'
import { materialRoutes } from '@/modules/inventory/material'
import { permitRoutes } from '@/modules/maintenance/work-permit'
import { workRequestRoutes } from '@/modules/maintenance/work-request'
import { workOrderRoutes } from '@/modules/maintenance/work-order'
import { Navigate, useRoutes } from 'react-router-dom'
import { AppLayout } from '@/layout/AppLayout'
import { identityRoutes } from '@/modules/identity'
import { approvalRoutes } from '@/modules/approvals'
import { LoginHistoryPage, LoginPage, RequireAuth } from '@/modules/auth'
import { codeRoutes } from '@/modules/codes'
import { equipmentRoutes } from '@/modules/maintenance/equipment'
import { preventiveMaintenanceRoutes } from '@/modules/maintenance/preventive-maintenance'
import { organizationRoutes } from '@/modules/organization'
import { HomePage } from './HomePage'

function App() {
  return useRoutes([
    { path: '/login', element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <HomePage /> },
            { path: '/login-history', element: <LoginHistoryPage /> },
            ...organizationRoutes,
            ...identityRoutes,
            ...codeRoutes,
            ...preventiveMaintenanceRoutes,
            ...workOrderRoutes,
            ...workRequestRoutes,
            ...permitRoutes,
            ...approvalRoutes,
            ...boardRoutes,
            ...equipmentRoutes,
            ...materialRoutes,
            ...purchaseRoutes,
            ...vendorRoutes,
            ...inventoryRoutes,
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ])
}

export default App
