import { http } from '@/shared/api/http'
export interface PermitData {
  title: string
  applicationDate: string
  applicantType: string
  applicantName: string
  organization: string
  phone: string
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
  issuerId: string
  approverId: string
  documentFiles: {
    requirementId: string
    attachmentId: string
    itemNo: number
  }[]
}
export interface PermitOptions {
  templates: PermitSection[]
  names: Record<string, string>
  documents: { id: string; name: string }[]
  users: { value: string; label: string }[]
}
export const permitApi = {
  list: async (path: string) => (await http.get<PermitRecord[]>(path)).data,
  get: async (path: string) => (await http.get<PermitRecord>(path)).data,
  options: async () =>
    (await http.get<PermitOptions>('/work-permit/options')).data,
  save: async (
    path: string,
    body: unknown,
    create: boolean,
    requestKey: string,
  ) =>
    (
      await http.request<PermitRecord>({
        method: create ? 'POST' : 'PATCH',
        url: path,
        data: body,
        headers: create ? { 'Idempotency-Key': requestKey } : undefined,
      })
    ).data,
  remove: async (path: string) => http.delete(path),
  request: async (path: string) =>
    (await http.post<PermitRecord>(`${path}/submit`)).data,
}
export const permitHttp = http
