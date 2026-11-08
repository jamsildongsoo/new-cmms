export interface DepartmentResponseDto {
  companyId: string;
  deptId: string;
  name: string;
  parentDeptId: string | null;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
