import { http } from '@/shared/api/http'
import type { ReportRow } from '../common/report.types'
export const stockApi = {
  balances: async (params: Record<string, string>) =>
    (
      await http.get<{ warehouses: ReportRow[]; sites: ReportRow[] }>(
        '/stock-status',
        { params },
      )
    ).data,
  ledger: async (params: Record<string, string>) =>
    (await http.get<ReportRow[]>('/stock-ledger', { params })).data,
}
