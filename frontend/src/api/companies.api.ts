import { http } from './http'

export interface Company {
  companyId: string
  name: string
  registrationNumber: string | null
  note: string | null
  deleteYn: string
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
}

export interface CompanyPayload {
  name: string
  registrationNumber?: string | null
  note?: string | null
}

export async function getCompany() {
  const response = await http.get<Company>('/companies')
  return response.data
}

export async function createCompany(payload: CompanyPayload) {
  const response = await http.post<Company>('/companies', payload)
  return response.data
}

export async function updateCompany(payload: CompanyPayload) {
  const response = await http.patch<Company>('/companies', payload)
  return response.data
}
