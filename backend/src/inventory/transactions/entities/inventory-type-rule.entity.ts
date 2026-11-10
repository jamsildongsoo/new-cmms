import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('inventory_type_rule')
export class InventoryTypeRule {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) typeCode: string;
  @Column({ type: 'varchar', length: 50 }) processingKind: string;
}
