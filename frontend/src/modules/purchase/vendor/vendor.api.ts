import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
export interface VendorFields {
  name: string
  registrationNumber: string | null
  representativeName: string | null
  contactName: string | null
  phoneNumber: string | null
  email: string | null
  address: string | null
  note: string | null
}
export interface Vendor extends VendorFields, AuditFields {
  companyId: string
  vendorId: string
  deleteYn: string
}
export const vendorApi = {
  list: async (params: { page: number; search: string; searchType?: string }) =>
    (
      await http.get<{
        items: Vendor[]
        total: number
        page: number
        limit: number
      }>('/vendor', { params })
    ).data,
  get: async (id: string) =>
    (await http.get<Vendor>(`/vendor/${encodeURIComponent(id)}`)).data,
  create: async (vendorId: string, fields: VendorFields) =>
    (await http.post<Vendor>('/vendor', { vendorId, ...fields })).data,
  update: async (id: string, fields: VendorFields) =>
    (await http.patch<Vendor>(`/vendor/${encodeURIComponent(id)}`, fields))
      .data,
  deletionInfo: async (id: string) =>
    (
      await http.get<{ purchaseOrderCount: number }>(
        `/vendor/${encodeURIComponent(id)}/deletion-info`,
      )
    ).data,
  remove: async (id: string) =>
    (await http.delete(`/vendor/${encodeURIComponent(id)}`)).data,
}
