import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('monthly_stock_balance')
export class MonthlyStockBalance {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'char', length: 6 }) yearMonth: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) siteId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) warehouseId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  openingQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  receiptQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  issueQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  transferInQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  transferOutQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  adjustIncreaseQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  adjustDecreaseQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  closingQuantity: string;
}
