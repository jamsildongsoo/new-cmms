import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('inventory_control')
export class InventoryControl {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @Column({ type: 'bigint', default: 0 }) lastSequence: string;
}
