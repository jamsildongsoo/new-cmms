import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('company')
export class Company extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
