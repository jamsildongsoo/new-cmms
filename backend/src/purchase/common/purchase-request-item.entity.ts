import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('purchase_request_item')
export class PurchaseRequestItem {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) requestId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) itemId: string;
  @Column({ type: 'integer' }) sortOrder: number;
  @Column({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'varchar', length: 150 }) materialName: string;
  @Column({ type: 'varchar', length: 30 }) baseUnit: string;
  @Column({ type: 'text', nullable: true }) spec: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 6 }) quantity: string;
}
