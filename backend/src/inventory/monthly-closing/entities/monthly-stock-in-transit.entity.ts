import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('monthly_stock_in_transit')
export class MonthlyStockInTransit {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'char', length: 6 }) yearMonth: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) outDocumentId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) outItemId: string;
  @Column({ type: 'varchar', length: 30 }) siteId: string;
  @Column({ type: 'varchar', length: 30 }) toSiteId: string;
  @Column({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  openingQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  dispatchedQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  receivedQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  closingQuantity: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  openingAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  dispatchedAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  receivedAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  closingAmount: string;
}
