import { AccessScope } from '../../identity/users/entities/user.entity';

export interface UserContext {
  companyId: string;
  userId: string;
  roleId: string;
  deptId: string;
  accessScope: AccessScope;
  permissions: readonly string[];
}
