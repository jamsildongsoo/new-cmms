import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';
import { DocumentStatus } from '../../../common/constants/document-status';

@Entity('work_request')
export class WorkRequest extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) workRequestId: string;
  @Column({ type: 'varchar', length: 50 }) documentNo: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'varchar', length: 50 }) equipmentId: string;
  @Column({ type: 'char', length: 8 }) occurredDate: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) priorityCode:
    string | null;
  @Column({ type: 'varchar', length: 50 }) requesterId: string;
  // 작성 당시 소속을 보존한다. 별도 접수 부서나 담당자를 자동 추론하지 않는다.
  @Column({ type: 'varchar', length: 30, nullable: true }) siteId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) deptId:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'char', length: 1, default: DocumentStatus.DRAFT })
  status: DocumentStatus;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
