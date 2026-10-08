import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('site')
export class Site extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  siteId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
