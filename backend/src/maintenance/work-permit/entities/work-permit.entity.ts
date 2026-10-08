import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../../common/constants/document-status';
import { AuditEntity } from '../../../common/entities/audit.entity';

@Entity('work_permit')
export class WorkPermit extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  // Client-generated UUID so attachments can link before the first save.
  @PrimaryColumn({ type: 'varchar', length: 50 })
  workPermitId: string;

  @Column({ type: 'varchar', length: 50 })
  documentNo: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'char', length: 8 })
  workDate: string;

  @Column({ type: 'varchar', length: 11 })
  startTime: string;

  @Column({ type: 'varchar', length: 11 })
  endTime: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  supervisor: string | null;

  @Column({ type: 'text', nullable: true })
  equipmentText: string | null;

  @Column({ type: 'text', nullable: true })
  workSummary: string | null;

  @Column({ type: 'text', nullable: true })
  riskFactor: string | null;

  @Column({ type: 'text', nullable: true })
  safetyAction: string | null;

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
