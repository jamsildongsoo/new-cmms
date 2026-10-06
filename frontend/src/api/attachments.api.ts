import { http } from './http'

export interface Attachment {
  companyId: string
  attachmentId: string
  refModule: string
  refNo: string
  deleteYn: string
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
}

export interface AttachmentItem {
  companyId: string
  attachmentId: string
  itemNo: number
  originalName: string
  storedName: string
  storagePath: string
  mimeType: string | null
  sizeBytes: number
  deleteYn: string
  createdBy: string
  createdAt: string
}

export async function createAttachment(refModule: string, refNo: string) {
  const response = await http.post<Attachment>('/attachments', {
    refModule,
    refNo,
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
