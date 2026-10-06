export interface RoleResponseDto {
  companyId: string;
  roleId: string;
  name: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
