import { http } from '@/shared/api/http'
import type { ReportRow } from '../common/report.types'
export interface Period {
  yearMonth: string
  locked: boolean
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
}
export interface MonthlyReport {
  period: Period | null
  warehouses: ReportRow[]
  nextMonth: string
}
export const monthlyClosingApi = {
  periods: async () => (await http.get<Period[]>('/monthly-closing')).data,
  monthly: async (month: string) =>
    (await http.get<MonthlyReport>(`/monthly-closing/${month}`)).data,
  periodAction: async (month: string, action: 'open' | 'unlock' | 'close') =>
    (await http.post<MonthlyReport>(`/monthly-closing/${month}/${action}`))
      .data,
}
