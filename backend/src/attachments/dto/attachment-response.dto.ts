export interface AttachmentResponseDto {
  companyId: string;
  attachmentId: string;
  refModule: string;
  refId: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
