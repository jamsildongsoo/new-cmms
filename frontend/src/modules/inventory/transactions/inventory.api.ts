import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
export interface InventoryItem {
  itemId: string
  materialId: string
  materialName: string
  spec: string | null
  baseUnit: string
  quantity: string
  unitPrice: string
  amount: string
  refItemId: string | null
  note: string | null
}
export interface InventoryRecord extends AuditFields {
  inventoryDocumentId: string
  documentNo: string
  title: string
  typeCode: string
  processingKind: string
  postingDate: string
  siteId: string
  warehouseId: string
  deptId: string | null
  toSiteId: string | null
  toWarehouseId: string | null
  toDeptId: string | null
  refModule: string | null
  refId: string | null
  referenceNo: string | null
  attachmentId: string | null
  reason: string | null
  note: string | null
  status: 'D' | 'C'
  items: InventoryItem[]
}
export interface Period {
  yearMonth: string
  locked: boolean
  summaryDirty: boolean
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
}
export interface InventoryOptions {
  types: { value: string; label: string; kind: string }[]
  materials: {
    materialId: string
    name: string
    spec: string | null
    baseUnit: string
  }[]
  sites: { value: string; label: string }[]
  warehouses: { siteId: string; warehouseId: string; name: string }[]
  departments: { value: string; label: string }[]
  orders: { orderId: string; documentNo: string; title: string }[]
  periods: Period[]
  transfers: {
    inventoryDocumentId: string
    documentNo: string
    title: string
    toSiteId: string
    toWarehouseId: string
    toDeptId: string | null
  }[]
}
export interface InventoryReference {
  referenceNo: string
  title: string
  toSiteId: string | null
  toWarehouseId: string | null
  toDeptId: string | null
  items: Omit<InventoryItem, 'itemId' | 'amount' | 'note'>[]
}
export type ReportRow = Record<string, string | boolean | null>
export interface MonthlyReport {
  period: Period | null
  warehouses: ReportRow[]
  sites: ReportRow[]
  transits: ReportRow[]
  draftCount: number
  nextMonth: string
}
export const inventoryApi = {
  list: async (params: Record<string, string>) =>
    (await http.get<InventoryRecord[]>('/inventory-document', { params })).data,
  get: async (id: string) =>
    (await http.get<InventoryRecord>(`/inventory-document/${id}`)).data,
  options: async () =>
    (await http.get<InventoryOptions>('/inventory-document/options')).data,
  initializeTypes: async () =>
    http.post('/inventory-document/initialize-types'),
  reference: async (module: string, id: string) =>
    (
      await http.get<InventoryReference>(
        `/inventory-document/reference/${module}/${id}`,
      )
    ).data,
  save: async (id: string, body: unknown, create: boolean) =>
    (
      await http.request<InventoryRecord>({
        url: create ? '/inventory-document' : `/inventory-document/${id}`,
        method: create ? 'POST' : 'PATCH',
        headers: create ? { 'Idempotency-Key': id } : undefined,
        data: body,
      })
    ).data,
  confirm: async (id: string) =>
    (await http.post<InventoryRecord>(`/inventory-document/${id}/confirm`))
      .data,
  remove: async (id: string) => http.delete(`/inventory-document/${id}`),
  balances: async (params: Record<string, string>) =>
    (
      await http.get<{ warehouses: ReportRow[]; sites: ReportRow[] }>(
        '/stock-status',
        { params },
      )
    ).data,
  ledger: async (params: Record<string, string>) =>
    (await http.get<ReportRow[]>('/stock-ledger', { params })).data,
  periods: async () => (await http.get<Period[]>('/monthly-closing')).data,
  monthly: async (month: string) =>
    (await http.get<MonthlyReport>(`/monthly-closing/${month}`)).data,
  periodAction: async (month: string, action: 'open' | 'unlock' | 'close') =>
    (await http.post<MonthlyReport>(`/monthly-closing/${month}/${action}`))
      .data,
}
