export interface SiteResponseDto {
  companyId: string;
  siteId: string;
  name: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
