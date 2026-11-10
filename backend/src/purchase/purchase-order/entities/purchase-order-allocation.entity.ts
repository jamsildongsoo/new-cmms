import { Column, Entity, PrimaryColumn, Index } from 'typeorm';
@Entity('purchase_order_allocation')
@Index(['companyId', 'requestId'])
export class PurchaseOrderAllocation {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) allocationId: string;
  @Column({ type: 'varchar', length: 50 }) orderId: string;
  @Column({ type: 'varchar', length: 50 }) orderItemId: string;
  @Column({ type: 'varchar', length: 50 }) requestId: string;
  @Column({ type: 'varchar', length: 50 }) requestItemId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6 }) quantity: string;
}
