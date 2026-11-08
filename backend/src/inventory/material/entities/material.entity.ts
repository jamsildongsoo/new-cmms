import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';

// 자재번호는 사용자가 관리하며 회사 안에서만 유일하다. 결재 상태는 두지 않는다.
@Entity('material')
@Index(['companyId', 'typeCode'])
export class Material extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'varchar', length: 50 }) typeCode: string;
  @Column({ type: 'varchar', length: 30 }) baseUnit: string;
  @Column({ type: 'text', nullable: true }) spec: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) maker:
    string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) model:
    string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
