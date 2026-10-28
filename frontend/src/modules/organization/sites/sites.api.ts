import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'

export interface Site extends AuditFields {
  companyId: string
  deleteYn: string
  siteId: string
  name: string
}

export interface SitePayload {
  siteId?: string
  name: string
}

export async function getSites() {
  const response = await http.get<Site[]>('/sites')
  return response.data
}

export async function getSite(siteId: string) {
  const response = await http.get<Site>(`/sites/${siteId}`)
  return response.data
}

export async function createSite(payload: SitePayload) {
  const response = await http.post<Site>('/sites', payload)
  return response.data
}

export async function updateSite(siteId: string, payload: SitePayload) {
  const response = await http.patch<Site>(`/sites/${siteId}`, payload)
  return response.data
}

export async function deleteSite(siteId: string) {
  const response = await http.delete<Site>(`/sites/${siteId}`)
  return response.data
}
