import { AccessScope } from '../../identity/users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  companyId: string;
  roleId: string;
  deptId: string;
  accessScope: AccessScope;
}
