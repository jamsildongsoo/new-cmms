export interface AttachmentItemResponseDto {
  companyId: string;
  attachmentId: string;
  itemNo: number;
  originalName: string;
  fileExtension: string | null;
  mimeType: string | null;
  size: number;
  checksum: string | null;
}
