export interface CodeItemResponseDto {
  companyId: string;
  codeId: string;
  codeItemId: string;
  name: string;
  sortOrder: number;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
