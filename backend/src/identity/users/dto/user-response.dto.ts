import { AccessScope } from '../entities/user.entity';

export interface UserResponseDto {
  companyId: string;
  userId: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  title: string | null;
  position: string | null;
  roleId: string;
  siteId: string | null;
  siteName: string | null;
  deptName: string | null;
  deptId: string;
  accessScope: AccessScope;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
