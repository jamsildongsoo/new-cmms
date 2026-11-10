import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('inventory_item')
export class InventoryItem {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) inventoryDocumentId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) itemId: string;
  @Column({ type: 'integer' }) sortOrder: number;
  @Column({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'varchar', length: 150 }) materialName: string;
  @Column({ type: 'varchar', length: 30 }) baseUnit: string;
  @Column({ type: 'text', nullable: true }) spec: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  unitPrice: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  amount: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) refItemId:
    string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
}
