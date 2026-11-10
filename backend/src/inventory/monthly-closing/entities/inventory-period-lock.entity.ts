import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';
@Entity('inventory_period_lock')
export class InventoryPeriodLock extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'char', length: 6 }) yearMonth: string;
  @Column({ type: 'boolean', default: false }) locked: boolean;
  @Column({ type: 'boolean', default: true }) summaryDirty: boolean;
}
