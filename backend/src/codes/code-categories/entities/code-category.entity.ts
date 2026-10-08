import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('code_category')
export class CodeCategoryEntity extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  codeId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  module: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
