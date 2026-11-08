import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/types/document'
export type PurchaseKind = 'request' | 'order'
export interface PurchaseItem {
  itemId: string
  materialId: string
  materialName: string
  spec: string | null
  baseUnit: string
  quantity: string
  unitPrice?: string | null
  amount?: string | null
  note: string | null
}
export interface Allocation {
  allocationId: string
  orderItemId: string
  requestId: string
  requestItemId: string
  quantity: string
}
export interface PurchaseRecord extends AuditFields {
  companyId: string
  requestId?: string
  orderId?: string
  documentNo: string
  title: string
  status: DocumentStatus
  siteId: string | null
  deptId: string | null
  requesterId: string
  typeCode: string | null
  requestDate?: string | null
  requiredDate?: string | null
  orderDate?: string | null
  expectedDeliveryDate?: string | null
  content: string | null
  note: string | null
  attachmentId: string | null
  totalAmount?: string
  sourceRequestIds?: string[]
  supplierName?: string | null
  vendorId?: string | null
  supplierRegistrationNo?: string | null
  supplierContactName?: string | null
  supplierPhone?: string | null
  supplierEmail?: string | null
  deliveryLocation?: string | null
  currency?: string
  items: PurchaseItem[]
  allocations: Allocation[]
}
export interface PurchaseOptions {
  materials: {
    materialId: string
    name: string
    spec: string | null
    baseUnit: string
  }[]
  sites: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  users: { value: string; label: string }[]
  types: { value: string; label: string }[]
  vendors: {
    vendorId: string
    name: string
    registrationNo: string | null
    contactName: string | null
    phone: string | null
    email: string | null
  }[]
  requests: { requestId: string; documentNo: string; title: string }[]
}
export const purchaseBase = (kind: PurchaseKind) =>
  kind === 'request' ? '/purchase-request' : '/purchase-order'
export const purchaseApi = {
  list: async (kind: PurchaseKind, params: Record<string, string>) =>
    (await http.get<PurchaseRecord[]>(purchaseBase(kind), { params })).data,
  get: async (kind: PurchaseKind, id: string) =>
    (
      await http.get<PurchaseRecord>(
        `${purchaseBase(kind)}/${encodeURIComponent(id)}`,
      )
    ).data,
  options: async (kind: PurchaseKind) =>
    (await http.get<PurchaseOptions>(`${purchaseBase(kind)}/options`)).data,
  save: async (
    kind: PurchaseKind,
    id: string,
    body: unknown,
    create: boolean,
  ) =>
    (
      await http.request<PurchaseRecord>({
        url: create ? purchaseBase(kind) : `${purchaseBase(kind)}/${id}`,
        method: create ? 'POST' : 'PATCH',
        headers: create ? { 'Idempotency-Key': id } : undefined,
        data: body,
      })
    ).data,
  remove: async (kind: PurchaseKind, id: string) =>
    http.delete(`${purchaseBase(kind)}/${id}`),
  preview: async (requestIds: string[]) =>
    (
      await http.post<{
        items: PurchaseItem[]
        hasLinkedOrders: boolean
        message: string | null
      }>('/purchase-order/request-preview', { requestIds })
    ).data,
}
