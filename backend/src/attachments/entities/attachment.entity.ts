import { AuditEntity } from '../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

// 업무 문서의 첨부 그룹. refModule/refId로 원본을 식별하며 파일이 없어도 유지한다.
@Entity('attachment')
export class Attachment extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  attachmentId: string;

  @Column({ type: 'varchar', length: 50 })
  refModule: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refId: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
