import type { AuditFields } from '@/shared/types/audit'
import { http } from '@/shared/api/http'

export interface Attachment extends AuditFields {
  companyId: string
  attachmentId: string
  refModule: string
  refId: string | null
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

// 회사는 서버의 인증 정보로 결정하며, 부모 문서를 식별하는 모듈명과 문서 ID만 보낸다.
export async function createAttachment(
  refModule: string,
  refId: string | null,
) {
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
  // 백엔드 FilesInterceptor('files')와 같은 필드명으로 여러 파일을 전송한다.
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
