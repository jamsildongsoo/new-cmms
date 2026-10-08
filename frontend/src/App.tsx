import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './auth/LoginPage'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './layout/AppLayout'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { CodeCategoriesPage } from './pages/CodeCategoriesPage'
import { CodeItemsPage } from './pages/CodeItemsPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { PreventiveMaintenancePage } from './pages/PreventiveMaintenancePage'
import { SitesPage } from './pages/SitesPage'
import { WarehousesPage } from './pages/WarehousesPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<PlaceholderPage title="Home" />} />
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />
          <Route path="users" element={<PlaceholderPage title="Users" />} />
          <Route path="roles" element={<PlaceholderPage title="Roles" />} />
          <Route path="permissions" element={<PlaceholderPage title="Permissions" />} />
          <Route path="code-categories" element={<CodeCategoriesPage />} />
          <Route path="code-items" element={<CodeItemsPage />} />
          <Route path="equipment" element={<PlaceholderPage title="Equipment" />} />
          <Route
            path="preventive-maintenance"
            element={<PreventiveMaintenancePage />}
          />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
