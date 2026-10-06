export interface CodeCategoryResponseDto {
  companyId: string;
  codeId: string;
  name: string;
  module: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
