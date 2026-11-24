import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

import { AccessScope } from '../user.constant';
export { AccessScope } from '../user.constant';

@Entity('user')
export class User extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'integer', default: 0 })
  tokenVersion: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null;

  @Column({ type: 'varchar', length: 30 })
  roleId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  deptId: string | null;

  @Column({ type: 'varchar', length: 30 })
  accessScope: AccessScope;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
