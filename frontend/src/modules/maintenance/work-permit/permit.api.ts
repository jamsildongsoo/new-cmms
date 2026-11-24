// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { http } from '@/shared/api/http'
// API 계약: backend/src/maintenance/work-permit/dto/permit-data.dto.ts와 함께 수정한다.
export interface PermitData {
  title: string
  applicationDate: string
  applicantType: string
  applicantName: string
  organization: string
  phoneNumber: string
  workType: string
  location: string
  equipmentNo: string
  equipmentName: string
  startTime: string
  endTime: string
  summary: string
}
export interface PermitSection {
  type: string
  templateVersion: number
  safetyRequirements: string
  specialRequirements: string
  safetyReviewOpinion: string
}
export interface PermitRecord {
  siteId: string | null
  deptId: string | null
  workPermitId?: string
  workPermitRequestId?: string
  documentNo: string
  data: PermitData
  status: string
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
  attachmentId: string | null
  refModule: string | null
  refId: string | null
  permitTypes: string[]
  sections: PermitSection[]
  issuerName?: string | null
  approverName?: string | null
  issuerId: string
  approverId: string
  documentFiles: {
    requirementId: string
    attachmentId: string
    itemNo: number
  }[]
}
export interface PermitOptions {
  sites: { value: string; label: string }[]
  departments: { value: string; label: string }[]
  templates: PermitSection[]
  names: Record<string, string>
  documents: { id: string; name: string }[]
  users: { value: string; label: string }[]
}
export interface PermitOrganizationOptions {
  sites: { value: string; label: string }[]
  departments: { value: string; label: string }[]
}
// API 계약: backend/src/maintenance/work-permit 및 work-permit-request의 목록 DTO·응답과 함께 수정한다.
export interface PermitListItem {
  workPermitId?: string
  workPermitRequestId?: string
  documentNo: string
  title: string
  applicantName: string
  status: string
}
export interface PermitPage {
  items: PermitListItem[]
  total: number
  page: number
  limit: number
}
export const permitApi = {
  list: async (path: string, params: { page: number; search?: string; searchType?: 'id' | 'documentNo' | 'title' | 'createdBy' }) =>
    (await http.get<PermitPage>(path, { params })).data,
  get: async (path: string) => (await http.get<PermitRecord>(path)).data,
  options: async () =>
    (await http.get<PermitOptions>('/work-permit/options')).data,
  requestOptions: async () =>
    (await http.get<PermitOrganizationOptions>('/work-permit-request/options')).data,
  save: async (path: string, body: unknown, create: boolean) =>
    (
      await http.request<PermitRecord>({
        method: create ? 'POST' : 'PATCH',
        url: path,
        data: body,
      })
    ).data,
  remove: async (path: string) => http.delete(path),
  request: async (path: string) =>
    (await http.post<PermitRecord>(`${path}/submit`)).data,
}
export const permitHttp = http
