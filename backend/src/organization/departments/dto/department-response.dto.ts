export interface DepartmentResponseDto {
  companyId: string;
  deptId: string;
  siteId: string | null;
  name: string;
  parentDeptId: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
