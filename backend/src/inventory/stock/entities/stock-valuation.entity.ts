import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('stock_valuation')
export class StockValuation {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) siteId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  amount: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  averagePrice: string;
}
