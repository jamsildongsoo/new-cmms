import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../common/constants/document-status';

@Entity('approval')
export class Approval {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  approvalId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refModule: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refNo: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'jsonb' })
  contentJson: unknown;

  @Column({ type: 'varchar', length: 50 })
  submitterId: string;

  @Column({ type: 'char', length: 1, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

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
