export interface PermissionResponseDto {
  permissionId: string;
  module: string;
  action: string;
  name: string;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
