import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../../common/constants/document-status';
import { AuditEntity } from '../../../common/entities/audit.entity';

@Entity('purchase_request')
export class PurchaseRequest extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  // Client-generated UUID so attachments can link before the first save.
  @PrimaryColumn({ type: 'varchar', length: 50 })
  requestId: string;

  @Column({ type: 'varchar', length: 50 })
  documentNo: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  typeCode: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  requiredDate: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 50 })
  requesterId: string;

  @Column({ type: 'char', length: 1, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
