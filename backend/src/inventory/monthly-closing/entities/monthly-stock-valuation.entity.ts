import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('monthly_stock_valuation')
export class MonthlyStockValuation {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'char', length: 6 }) yearMonth: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) siteId: string;
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
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  openingAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  receiptAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  issueAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  adjustIncreaseAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  adjustDecreaseAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  closingAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  averagePrice: string;
}
