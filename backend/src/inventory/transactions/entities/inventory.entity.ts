import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';

@Entity('inventory_document')
export class InventoryDocument extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) inventoryDocumentId: string;
  @Column({ type: 'varchar', length: 50 }) documentNo: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'varchar', length: 50 }) typeCode: string;
  @Column({ type: 'varchar', length: 50 }) processingKind: string;
  @Column({ type: 'char', length: 8 }) postingDate: string;
  @Column({ type: 'varchar', length: 30 }) siteId: string;
  @Column({ type: 'varchar', length: 30 }) warehouseId: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) deptId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) toSiteId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) toWarehouseId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) toDeptId:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) refModule:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) refId: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) referenceNo:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'char', length: 1, default: 'D' }) status: 'D' | 'C';
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
  @Column({ type: 'bigint', nullable: true }) postingSequence: string | null;
}

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

@Entity('inventory_type_rule')
export class InventoryTypeRule {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) typeCode: string;
  @Column({ type: 'varchar', length: 50 }) processingKind: string;
}

@Entity('inventory_control')
export class InventoryControl {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @Column({ type: 'bigint', default: 0 }) lastSequence: string;
}

@Entity('inventory_period_lock')
export class InventoryPeriodLock extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'char', length: 6 }) yearMonth: string;
  @Column({ type: 'boolean', default: false }) locked: boolean;
  @Column({ type: 'boolean', default: true }) summaryDirty: boolean;
}

@Entity('stock_balance')
export class StockBalance {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) siteId: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) warehouseId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) materialId: string;
  @Column({ type: 'numeric', precision: 20, scale: 6, default: 0 })
  quantity: string;
}

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
