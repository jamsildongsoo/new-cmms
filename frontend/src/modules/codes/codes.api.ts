import { http } from '@/shared/api/http'

export interface CodeItem {
  companyId: string
  codeId: string
  codeItemId: string
  name: string
  sortOrder: number
}

export interface CodeItemPayload {
  codeId?: string
  codeItemId?: string
  name: string
  sortOrder?: number | string
}

export async function getCodeItems(codeId: string) {
  const response = await http.get<CodeItem[]>('/code-items', {
    params: { codeId },
  })
  return response.data
}

export async function getCodeItem(codeId: string, codeItemId: string) {
  const response = await http.get<CodeItem>(
    `/code-items/${codeId}/${codeItemId}`,
  )
  return response.data
}

export async function createCodeItem(payload: CodeItemPayload) {
  const response = await http.post<CodeItem>('/code-items', toItemBody(payload))
  return response.data
}

export async function updateCodeItem(
  codeId: string,
  codeItemId: string,
  payload: CodeItemPayload,
) {
  const response = await http.patch<CodeItem>(
    `/code-items/${codeId}/${codeItemId}`,
    toItemBody(payload),
  )
  return response.data
}

export async function deleteCodeItem(codeId: string, codeItemId: string) {
  const response = await http.delete<CodeItem>(
    `/code-items/${codeId}/${codeItemId}`,
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
