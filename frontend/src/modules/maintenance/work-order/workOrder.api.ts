import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/types/document'

export type OrderKind = 'PLAN' | 'ACTUAL'
export interface LaborItem {
  workerName: string
  content: string
  hours: number
}
export interface MaterialItem {
  name: string
  spec: string
  quantity: number
  unit: string
  unitPrice: number
  amount: number
}
export interface CostItem {
  name: string
  amount: number
  note: string
}
export interface WorkOrderPayload {
  attachmentId: string | null
  documentNo: string
  title: string
  refModule: string | null
  refId: string | null
  equipmentId: string
  workDate: string
  typeCode: string | null
  content: string | null
  note: string | null
  laborItems: LaborItem[]
  materials: Omit<MaterialItem, 'amount'>[]
  costItems: CostItem[]
}
export interface WorkOrder
  extends AuditFields, Omit<WorkOrderPayload, 'materials'> {
  companyId: string
  workOrderId: string
  orderKind: OrderKind
  siteId: string | null
  deptId: string | null
  requesterId: string
  status: DocumentStatus
  deleteYn: string
  materials: MaterialItem[]
  totalHours: number
  materialTotal: number
  costTotal: number
  totalCost: number
}
export interface WorkOrderOptions {
  equipment: { value: string; label: string }[]
  types: { value: string; label: string }[]
  plans: {
    workOrderId: string
    documentNo: string
    title: string
    status: DocumentStatus
  }[]
  siteId: string | null
  deptId: string | null
  requests: {
    workRequestId: string
    documentNo: string
    title: string
    status: DocumentStatus
  }[]
}
export interface WorkOrderSearch {
  orderKind?: OrderKind
  status?: DocumentStatus
  searchType?: 'title' | 'documentNo' | 'equipmentId'
  searchVal?: string
  workDateFrom?: string
  workDateTo?: string
}
export async function getWorkOrders(params: WorkOrderSearch = {}) {
  return (await http.get<WorkOrder[]>('/work-order', { params })).data
}
export async function getWorkOrder(id: string) {
  return (await http.get<WorkOrder>(`/work-order/${encodeURIComponent(id)}`))
    .data
}
export async function getWorkOrderOptions() {
  return (await http.get<WorkOrderOptions>('/work-order/options')).data
}
export async function createWorkOrder(
  requestKey: string,
  orderKind: OrderKind,
  payload: WorkOrderPayload,
) {
  return (
    await http.post<WorkOrder>(
      '/work-order',
      {
        orderKind,
        ...payload,
      },
      { headers: { 'Idempotency-Key': requestKey } },
    )
  ).data
}
export async function updateWorkOrder(id: string, payload: WorkOrderPayload) {
  return (
    await http.patch<WorkOrder>(
      `/work-order/${encodeURIComponent(id)}`,
      payload,
    )
  ).data
}
export async function deleteWorkOrder(id: string) {
  return (await http.delete<WorkOrder>(`/work-order/${encodeURIComponent(id)}`))
    .data
}
