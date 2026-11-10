import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('stock_in_transit')
export class StockInTransit {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) outDocumentId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) outItemId: string;
  @Column({ type: 'varchar', length: 30 }) siteId: string;
  @Column({ type: 'varchar', length: 30 }) warehouseId: string;
  @Column({ type: 'varchar', length: 30 }) toSiteId: string;
  @Column({ type: 'varchar', length: 30 }) toWarehouseId: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) toDeptId:
    string | null;
  @Column({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'varchar', length: 150 }) materialName: string;
  @Column({ type: 'varchar', length: 30 }) baseUnit: string;
  @Column({ type: 'text', nullable: true }) spec: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  amount: string;
  @Column({ type: 'char', length: 8 }) postingDate: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) receivedDocumentId:
    string | null;
}
