import type { RouteObject } from 'react-router-dom'
import { CodeItemFormPage } from './CodeItemFormPage'
import { CodeItemListPage } from './CodeItemListPage'

export const codeRoutes: RouteObject[] = [
  { path: 'code-items', element: <CodeItemListPage /> },
  { path: 'code-items/new', element: <CodeItemFormPage mode="create" /> },
  { path: 'code-items/:codeId/:codeItemId', element: <CodeItemFormPage mode="view" /> },
  { path: 'code-items/:codeId/:codeItemId/edit', element: <CodeItemFormPage mode="edit" /> },
]
