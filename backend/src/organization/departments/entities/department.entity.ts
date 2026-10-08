import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('department')
export class Department extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  deptId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  parentDeptId: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
