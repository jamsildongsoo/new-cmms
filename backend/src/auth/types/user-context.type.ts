import { AccessScope } from '../../identity/users/entities/user.entity';

export interface UserContext {
  companyId: string;
  userId: string;
  roleId: string;
  siteId: string | null;
  deptId: string;
  accessScope: AccessScope;
  permissions: readonly string[];
}
