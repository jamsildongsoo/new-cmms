export interface MaterialResponseDto {
  companyId: string;
  materialId: string;
  name: string;
  typeCode: string;
  baseUnit: string;
  spec: string | null;
  maker: string | null;
  model: string | null;
  note: string | null;
  attachmentId: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
