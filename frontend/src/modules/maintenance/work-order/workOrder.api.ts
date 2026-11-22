// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/constants/document-status'

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
  // 백엔드 해당 업무 options API의 units(공통코드 UNIT)와 함께 수정한다.
  units: { value: string; label: string }[]
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
// API 계약: backend/src/maintenance/work-order의 목록 DTO·응답과 함께 수정한다.
export interface WorkOrderSearch {
  page?: number
  search?: string
}
export type WorkOrderListItem = Pick<
  WorkOrder,
  | 'workOrderId'
  | 'documentNo'
  | 'title'
  | 'orderKind'
  | 'equipmentId'
  | 'workDate'
  | 'totalCost'
  | 'status'
>
export interface WorkOrderPage {
  items: WorkOrderListItem[]
  total: number
  page: number
  limit: number
}
export async function getWorkOrders(params: WorkOrderSearch = {}) {
  return (await http.get<WorkOrderPage>('/work-order', { params })).data
}
export async function getWorkOrder(id: string) {
  return (await http.get<WorkOrder>(`/work-order/${encodeURIComponent(id)}`))
    .data
}
export async function getWorkOrderOptions() {
  return (await http.get<WorkOrderOptions>('/work-order/options')).data
}
export async function createWorkOrder(
  orderKind: OrderKind,
  payload: WorkOrderPayload,
) {
  return (await http.post<WorkOrder>('/work-order', { orderKind, ...payload }))
    .data
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
