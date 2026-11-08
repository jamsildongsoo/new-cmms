import { BoardFormPage, BoardListPage } from './BoardPages'
export const boardRoutes = [
  { path: '/boards', element: <BoardListPage /> },
  { path: '/boards/new', element: <BoardFormPage /> },
  { path: '/boards/:boardId', element: <BoardFormPage /> },
]
