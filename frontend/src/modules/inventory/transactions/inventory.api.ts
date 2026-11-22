// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { Period } from '../monthly-closing/monthly-closing.api'
import type { InventoryType, InventoryKind } from '../inventory.constant'
// backend/src/inventory/transactions의 DTO·Entity·응답과 함께 수정한다.
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
  type: InventoryType
  kind: InventoryKind | null
  postingDate: string
  siteId: string
  warehouseId: string
  deptId: string | null
  toSiteId: string | null
  toWarehouseId: string | null
  refModule: string | null
  refId: string | null
  attachmentId: string | null
  reason: string | null
  note: string | null
  sourceSiteId?: string | null
  sourceWarehouseId?: string | null
  status: 'W' | 'C' | 'X'
  postingSequence: string | null
  confirmedBy: string | null
  confirmedAt: string | null
  cancelledBy: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: InventoryItem[]
}
export type InventoryListItem = Pick<
  InventoryRecord,
  | 'inventoryDocumentId'
  | 'documentNo'
  | 'title'
  | 'type'
  | 'kind'
  | 'postingDate'
  | 'siteId'
  | 'warehouseId'
  | 'status'
>
export interface InventoryOptions {
  materials: {
    materialId: string
    name: string
    spec: string | null
    baseUnit: string
  }[]
  sites: { value: string; label: string }[]
  warehouses: { siteId: string; warehouseId: string; name: string }[]
  orders: { orderId: string; documentNo: string; title: string }[]
  periods: Period[]
}
export interface PurchaseReceiptSource {
  title: string
  siteId: string
  items: Omit<InventoryItem, 'itemId' | 'amount' | 'note'>[]
}
export const inventoryApi = {
  list: async (params: {
    page?: number
    search?: string
    type?: string
    kind?: string
    status?: string
  }) =>
    (
      await http.get<{
        items: InventoryListItem[]
        total: number
        page: number
        limit: number
      }>('/inventory-document', {
        params: Object.fromEntries(
          Object.entries(params).filter(
            ([, value]) => value !== '' && value !== undefined,
          ),
        ),
      })
    ).data,
  get: async (id: string) =>
    (
      await http.get<InventoryRecord>(
        `/inventory-document/${encodeURIComponent(id)}`,
      )
    ).data,
  options: async () =>
    (await http.get<InventoryOptions>('/inventory-document/options')).data,
  purchaseOrder: async (id: string) =>
    (
      await http.get<PurchaseReceiptSource>(
        `/inventory-document/purchase-order/${encodeURIComponent(id)}`,
      )
    ).data,
  create: async (body: unknown) =>
    (await http.post<InventoryRecord>('/inventory-document', body)).data,
  confirm: async (id: string, postingDate: string) =>
    (
      await http.post<InventoryRecord>(
        `/inventory-document/${encodeURIComponent(id)}/confirm`,
        { postingDate },
      )
    ).data,
  cancel: async (id: string, reason: string) =>
    (
      await http.post<InventoryRecord>(
        `/inventory-document/${encodeURIComponent(id)}/cancel`,
        { reason },
      )
    ).data,
}
