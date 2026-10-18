import { Navigate, useRoutes } from 'react-router-dom'
import { AppLayout } from '@/layout/AppLayout'
import { approvalRoutes } from '@/modules/approvals'
import { LoginPage, RequireAuth } from '@/modules/auth'
import { codeRoutes } from '@/modules/codes'
import { preventiveMaintenanceRoutes } from '@/modules/maintenance/preventive-maintenance'
import { organizationRoutes } from '@/modules/organization'
import { PlaceholderPage } from './PlaceholderPage'

const placeholders = ['users', 'roles', 'permissions', 'equipment'].map(
  (path) => ({
    path,
    element: <PlaceholderPage title={path[0].toUpperCase() + path.slice(1)} />,
  }),
)

function App() {
  return useRoutes([
    { path: '/login', element: <LoginPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { index: true, element: <PlaceholderPage title="Home" /> },
            ...organizationRoutes,
            ...codeRoutes,
            ...preventiveMaintenanceRoutes,
            ...approvalRoutes,
            ...placeholders,
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ])
}

export default App
