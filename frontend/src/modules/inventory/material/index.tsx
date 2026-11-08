import type { RouteObject } from 'react-router-dom'
import { MaterialListPage } from './MaterialListPage'
import { MaterialFormPage } from './MaterialFormPage'
export const materialRoutes: RouteObject[] = [
  { path: 'material', element: <MaterialListPage /> },
  { path: 'material/new', element: <MaterialFormPage mode="create" /> },
  { path: 'material/:materialId', element: <MaterialFormPage mode="view" /> },
  {
    path: 'material/:materialId/edit',
    element: <MaterialFormPage mode="edit" />,
  },
]
