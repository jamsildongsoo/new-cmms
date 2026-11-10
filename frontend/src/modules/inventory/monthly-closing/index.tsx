import type { RouteObject } from 'react-router-dom'
import { MonthlyClosing } from './MonthlyClosing'
export const monthlyClosingRoutes: RouteObject[] = [
  { path: 'monthly-closing', element: <MonthlyClosing /> },
]
