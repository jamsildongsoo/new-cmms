import { http } from '@/shared/api/http'
import type {
  PurchaseItemFields,
  PurchaseDocumentFields,
  PurchaseOptionsFields,
} from '../common/purchase.types'
export type PurchaseRequestItem = PurchaseItemFields
export interface PurchaseRequestRecord extends PurchaseDocumentFields {
  requestId: string
  requestDate: string | null
  requiredDate: string | null
  items: PurchaseRequestItem[]
}
export type PurchaseRequestOptions = PurchaseOptionsFields
export interface PurchaseRequestSave {
  documentNo?: string
  title: string
  siteId?: string | null
  deptId?: string | null
  requesterId?: string
  typeCode?: string | null
  content?: string | null
  note?: string | null
  attachmentId?: string | null
  requestDate?: string | null
  requiredDate?: string | null
  items: {
    itemId?: string
    materialId: string
    quantity: string
    note?: string | null
  }[]
}
export type PurchaseRequestListItem = Pick<
  PurchaseRequestRecord,
  'requestId' | 'documentNo' | 'title' | 'requestDate' | 'status'
>
import type { PurchaseListQuery, PurchasePage } from '../common/purchase.types'
export const purchaseRequestBase = '/purchase-request'
export const purchaseRequestLabel = '구매요청서'
export const purchaseRequestApi = {
  list: async (params: PurchaseListQuery) =>
    (
      await http.get<PurchasePage<PurchaseRequestListItem>>(
        purchaseRequestBase,
        { params },
      )
    ).data,
  get: async (id: string) =>
    (
      await http.get<PurchaseRequestRecord>(
        `${purchaseRequestBase}/${encodeURIComponent(id)}`,
      )
    ).data,
  options: async () =>
    (await http.get<PurchaseRequestOptions>(`${purchaseRequestBase}/options`))
      .data,
  save: async (id: string, body: PurchaseRequestSave, create: boolean) =>
    (
      await http.request<PurchaseRequestRecord>({
        url: create
          ? purchaseRequestBase
          : `${purchaseRequestBase}/${encodeURIComponent(id)}`,
        method: create ? 'POST' : 'PATCH',

        data: body,
      })
    ).data,
  remove: async (id: string) =>
    http.delete(`${purchaseRequestBase}/${encodeURIComponent(id)}`),
}
