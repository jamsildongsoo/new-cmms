import { AuditEntity } from '../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../common/constants/document-status';

@Entity('approval')
export class Approval extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  approvalId: string;

  // 시스템 문서 ID와 별개로 사용자가 입력하는 문서 관리번호. 기존 문서는 빈 값으로 유지한다.
  @Column({ type: 'varchar', length: 50, default: '' })
  documentNo: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refModule: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refId: string | null;

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

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
