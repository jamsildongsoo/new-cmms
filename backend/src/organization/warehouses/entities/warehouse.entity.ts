import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('warehouse')
export class Warehouse extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  warehouseId: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
