import type { AuditFields } from '@/shared/types/audit'
import type { DocumentStatus } from '@/shared/constants/document-status'
export interface PurchaseItemFields {
  itemId: string
  materialId: string
  materialName: string
  spec: string | null
  baseUnit: string
  quantity: string
  note: string | null
}
export interface PurchaseDocumentFields extends AuditFields {
  companyId: string
  documentNo: string
  title: string
  status: DocumentStatus
  siteId: string | null
  deptId: string | null
  requesterId: string
  typeCode: string | null
  content: string | null
  note: string | null
  attachmentId: string | null
}
export interface PurchaseOptionsFields {
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
}

// API 계약: backend/src/purchase/common/purchase-search.dto.ts 및 각 목록 응답과 함께 수정한다.
export interface PurchaseListQuery {
  page?: number
  search?: string
}
export interface PurchasePage<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
