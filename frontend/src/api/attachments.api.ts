import type { AuditFields } from '../types/audit'
import { http } from './http'

export interface Attachment extends AuditFields {
  companyId: string
  attachmentId: string
  refModule: string
  refId: string
  deleteYn: string
}

export interface AttachmentItem {
  companyId: string
  attachmentId: string
  itemNo: number
  originalName: string
  fileExtension: string | null
  mimeType: string | null
  size: number
  checksum: string | null
}

export async function createAttachment(refModule: string, refId: string) {
  const response = await http.post<Attachment>('/attachments', {
    refModule,
    refId,
  })
  return response.data
}

export async function getAttachmentItems(attachmentId: string) {
  const response = await http.get<AttachmentItem[]>(
    `/attachments/${attachmentId}/items`,
  )
  return response.data
}

export async function uploadAttachmentItems(
  attachmentId: string,
  files: FileList,
) {
  const formData = new FormData()
  Array.from(files).forEach((file) => formData.append('files', file))
  const response = await http.post<AttachmentItem[]>(
    `/attachments/${attachmentId}/items`,
    formData,
  )
  return response.data
}

export async function deleteAttachmentItem(
  attachmentId: string,
  itemNo: number,
) {
  const response = await http.delete<AttachmentItem>(
    `/attachments/${attachmentId}/items/${itemNo}`,
  )
  return response.data
}

export async function downloadAttachmentItem(
  attachmentId: string,
  itemNo: number,
) {
  const response = await http.get<Blob>(
    `/attachments/${attachmentId}/items/${itemNo}/download`,
    { responseType: 'blob' },
  )
  return response.data
}
