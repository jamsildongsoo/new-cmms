import { AuditEntity } from '../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('attachment')
export class Attachment extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  attachmentId: string;

  @Column({ type: 'varchar', length: 50 })
  refModule: string;

  @Column({ type: 'varchar', length: 50 })
  refId: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
