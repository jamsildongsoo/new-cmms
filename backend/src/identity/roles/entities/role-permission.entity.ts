import { Entity, PrimaryColumn } from 'typeorm';

@Entity('role_permission')
export class RolePermission {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  roleId: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  permissionId: string;
}
