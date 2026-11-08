import { http } from '@/shared/api/http'
import type { AuditFields } from '@/shared/types/audit'
export interface BoardComment extends AuditFields {
  commentId: string
  content: string
}
export interface Board extends AuditFields {
  boardId: string
  title: string
  content: string
  attachmentId: string | null
}
export interface BoardDetail extends Board {
  comments: BoardComment[]
}
export interface BoardPage {
  items: Board[]
  total: number
  page: number
  limit: number
}
export interface BoardPayload {
  title: string
  content: string
  attachmentId: string | null
}
const path = (id: string) => `/boards/${encodeURIComponent(id)}`
export const boardApi = {
  list: async (search: string, page: number) =>
    (
      await http.get<BoardPage>('/boards', {
        params: { search, page, limit: 20 },
      })
    ).data,
  get: async (id: string) => (await http.get<BoardDetail>(path(id))).data,
  create: async (payload: BoardPayload, requestKey: string) =>
    (
      await http.post<BoardDetail>('/boards', payload, {
        headers: { 'Idempotency-Key': requestKey },
      })
    ).data,
  update: async (id: string, payload: BoardPayload) =>
    (await http.patch<BoardDetail>(path(id), payload)).data,
  remove: async (id: string) => http.delete(path(id)),
  createComment: async (id: string, content: string) =>
    http.post(`${path(id)}/comments`, { content }),
  updateComment: async (id: string, commentId: string, content: string) =>
    http.patch(`${path(id)}/comments/${encodeURIComponent(commentId)}`, {
      content,
    }),
  removeComment: async (id: string, commentId: string) =>
    http.delete(`${path(id)}/comments/${encodeURIComponent(commentId)}`),
}
