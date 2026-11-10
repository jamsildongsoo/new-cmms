import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('stock_ledger')
export class StockLedger {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 180 }) ledgerId: string;
  @Column({ type: 'varchar', length: 50 }) inventoryDocumentId: string;
  @Column({ type: 'varchar', length: 50 }) itemId: string;
  @Column({ type: 'char', length: 8 }) postingDate: string;
  @Column({ type: 'bigint' }) postingSequence: string;
  @Column({ type: 'integer', default: 0 }) entryOrder: number;
  @Column({ type: 'varchar', length: 50 }) typeCode: string;
  @Column({ type: 'varchar', length: 50 }) processingKind: string;
  @Column({ type: 'varchar', length: 30 }) siteId: string;
  @Column({ type: 'varchar', length: 30 }) warehouseId: string;
  @Column({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantityChange: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  amountChange: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  balanceQuantity: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  siteQuantity: string;
  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  siteAmount: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, default: 0 })
  averagePrice: string;
}
