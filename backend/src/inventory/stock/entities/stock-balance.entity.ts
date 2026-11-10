import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('stock_balance')
export class StockBalance {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) siteId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) warehouseId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;
}
