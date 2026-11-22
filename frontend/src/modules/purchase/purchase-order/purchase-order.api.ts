// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { http } from '@/shared/api/http'
import type {
  PurchaseItemFields,
  PurchaseDocumentFields,
  PurchaseOptionsFields,
} from '../common/purchase.types'
import type { Vendor } from '../vendor/vendor.api'
export interface PurchaseOrderItem extends PurchaseItemFields {
  unitPrice: string | null
  amount: string | null
}
export interface PurchaseOrderRecord extends PurchaseDocumentFields {
  orderId: string
  toSiteId: string
  orderDate: string | null
  expectedDeliveryDate: string | null
  totalAmount: string
  refModule: string | null
  refId: string | null
  vendorId: string | null
  vendor: Vendor | null
  deliveryLocation: string | null
  currency: string
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
  toSiteId: string
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
  refModule?: string | null
  refId?: string | null
  items: {
    itemId?: string
    materialId: string
    quantity: string
    spec?: string | null
    note?: string | null
    unitPrice?: string | null
  }[]
}
export type PurchaseOrderListItem = Pick<
  PurchaseOrderRecord,
  'orderId' | 'documentNo' | 'title' | 'orderDate' | 'totalAmount' | 'status'
>
export type LinkedPurchaseOrder = Pick<
  PurchaseOrderRecord,
  'orderId' | 'documentNo' | 'title' | 'status' | 'createdAt'
>
import type { PurchaseListQuery, PurchasePage } from '../common/purchase.types'
export const purchaseOrderBase = '/purchase-order'
export const purchaseOrderLabel = '구매발주서'
export const purchaseOrderApi = {
  list: async (params: PurchaseListQuery) =>
    (
      await http.get<PurchasePage<PurchaseOrderListItem>>(purchaseOrderBase, {
        params,
      })
    ).data,
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

        data: body,
      })
    ).data,
  remove: async (id: string) =>
    http.delete(`${purchaseOrderBase}/${encodeURIComponent(id)}`),
  linkedOrders: async (requestId: string) =>
    (
      await http.get<LinkedPurchaseOrder[]>(
        `${purchaseOrderBase}/request/${encodeURIComponent(requestId)}/orders`,
      )
    ).data,
  // 최초 복사 계약: backend/src/purchase/purchase-order의 preview 응답과 함께 수정한다.
  preview: async (requestId: string) =>
    (
      await http.post<{
        title: string
        content: string | null
        note: string | null
        expectedDeliveryDate: string | null
        items: PurchaseOrderItem[]
      }>(`${purchaseOrderBase}/request-preview`, { requestId })
    ).data,
}
