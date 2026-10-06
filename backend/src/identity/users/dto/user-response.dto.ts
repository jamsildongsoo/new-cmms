import { AccessScope } from '../entities/user.entity';

export interface UserResponseDto {
  companyId: string;
  userId: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  roleId: string;
  deptId: string;
  accessScope: AccessScope;
  deleteYn: string;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}
