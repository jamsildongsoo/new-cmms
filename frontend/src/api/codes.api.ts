import type { AuditFields } from '../types/audit'
import { http } from './http'

export interface CodeCategory extends AuditFields {
  companyId: string
  codeId: string
  name: string
  module: string
  deleteYn: string
}

export interface CodeItem {
  companyId: string
  codeId: string
  codeItemId: string
  name: string
  sortOrder: number
}

export interface CodeCategoryPayload {
  codeId?: string
  name: string
  module: string
}

export interface CodeItemPayload {
  codeItemId?: string
  name: string
  sortOrder?: number | string
}

export async function getCodeCategories() {
  const response = await http.get<CodeCategory[]>('/code-categories')
  return response.data
}

export async function createCodeCategory(payload: CodeCategoryPayload) {
  const response = await http.post<CodeCategory>('/code-categories', payload)
  return response.data
}

export async function updateCodeCategory(
  codeId: string,
  payload: CodeCategoryPayload,
) {
  const response = await http.patch<CodeCategory>(
    `/code-categories/${codeId}`,
    payload,
  )
  return response.data
}

export async function deleteCodeCategory(codeId: string) {
  const response = await http.delete<CodeCategory>(`/code-categories/${codeId}`)
  return response.data
}

export async function getCodeItems(codeId: string) {
  const response = await http.get<CodeItem[]>(`/code-categories/${codeId}/items`)
  return response.data
}

export async function createCodeItem(codeId: string, payload: CodeItemPayload) {
  const response = await http.post<CodeItem>(
    `/code-categories/${codeId}/items`,
    toItemBody(payload),
  )
  return response.data
}

export async function updateCodeItem(
  codeId: string,
  codeItemId: string,
  payload: CodeItemPayload,
) {
  const response = await http.patch<CodeItem>(
    `/code-categories/${codeId}/items/${codeItemId}`,
    toItemBody(payload),
  )
  return response.data
}

export async function deleteCodeItem(codeId: string, codeItemId: string) {
  const response = await http.delete<CodeItem>(
    `/code-categories/${codeId}/items/${codeItemId}`,
  )
  return response.data
}

// The form edits sortOrder as text; the backend expects an integer.
function toItemBody(payload: CodeItemPayload) {
  const { sortOrder, ...rest } = payload
  if (sortOrder === undefined || sortOrder === '') {
    return rest
  }
  return { ...rest, sortOrder: Number(sortOrder) }
}
