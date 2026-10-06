import { Column, Entity, PrimaryColumn } from 'typeorm';

export const AccessScope = {
  OWN_DEPARTMENT: 'OWN_DEPARTMENT',
  OWN_SITE: 'OWN_SITE',
  COMPANY_ALL: 'COMPANY_ALL',
} as const;

export type AccessScope = (typeof AccessScope)[keyof typeof AccessScope];

@Entity('user')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 30 })
  roleId: string;

  @Column({ type: 'varchar', length: 30 })
  deptId: string;

  @Column({ type: 'varchar', length: 30 })
  accessScope: AccessScope;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;

  @Column({ type: 'varchar', length: 50 })
  createdBy: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
