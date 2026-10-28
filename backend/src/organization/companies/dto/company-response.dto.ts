export interface CompanyResponseDto {
  companyId: string;
  name: string;
  registrationNumber: string | null;
  note: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
