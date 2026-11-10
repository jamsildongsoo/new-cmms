import { http } from '@/shared/api/http'
import type {
  PurchaseItemFields,
  PurchaseDocumentFields,
  PurchaseOptionsFields,
} from '../common/purchase.types'
import type { Vendor } from '../vendor/vendor.api'
export interface Allocation {
  allocationId: string
  orderItemId: string
  requestId: string
  requestItemId: string
  quantity: string
}
export interface PurchaseOrderItem extends PurchaseItemFields {
  unitPrice: string | null
  amount: string | null
}
export interface PurchaseOrderRecord extends PurchaseDocumentFields {
  orderId: string
  orderDate: string | null
  expectedDeliveryDate: string | null
  totalAmount: string
  sourceRequestIds: string[]
  vendorId: string | null
  vendor: Vendor | null
  deliveryLocation: string | null
  currency: string
  allocations: Allocation[]
  items: PurchaseOrderItem[]
}
export interface PurchaseOrderOptions extends PurchaseOptionsFields {
  vendors: {
    vendorId: string
    name: string
    registrationNumber: string | null
    contactName: string | null
    phoneNumber: string | null
    email: string | null
  }[]
  requests: { requestId: string; documentNo: string; title: string }[]
}
export interface PurchaseOrderSave {
  documentNo?: string
  title: string
  siteId?: string | null
  deptId?: string | null
  requesterId?: string
  typeCode?: string | null
  content?: string | null
  note?: string | null
  attachmentId?: string | null
  orderDate?: string | null
  expectedDeliveryDate?: string | null
  vendorId?: string | null
  deliveryLocation?: string | null
  requestIds?: string[]
  items: {
    itemId?: string
    materialId: string
    quantity: string
    note?: string | null
    unitPrice?: string | null
  }[]
}
export const purchaseOrderBase = '/purchase-order'
export const purchaseOrderLabel = '구매발주서'
export const purchaseOrderApi = {
  list: async (params: Record<string, string>) =>
    (await http.get<PurchaseOrderRecord[]>(purchaseOrderBase, { params })).data,
  get: async (id: string) =>
    (
      await http.get<PurchaseOrderRecord>(
        `${purchaseOrderBase}/${encodeURIComponent(id)}`,
      )
    ).data,
  options: async () =>
    (await http.get<PurchaseOrderOptions>(`${purchaseOrderBase}/options`)).data,
  save: async (id: string, body: PurchaseOrderSave, create: boolean) =>
    (
      await http.request<PurchaseOrderRecord>({
        url: create
          ? purchaseOrderBase
          : `${purchaseOrderBase}/${encodeURIComponent(id)}`,
        method: create ? 'POST' : 'PATCH',
        headers: create ? { 'Idempotency-Key': id } : undefined,
        data: body,
      })
    ).data,
  remove: async (id: string) =>
    http.delete(`${purchaseOrderBase}/${encodeURIComponent(id)}`),
  preview: async (requestIds: string[]) =>
    (
      await http.post<{
        items: PurchaseOrderItem[]
        hasLinkedOrders: boolean
        message: string | null
      }>('/purchase-order/request-preview', { requestIds })
    ).data,
}
