import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { InventoryStatus } from '../../inventory.constant';
import { AuditEntity } from '../../../common/entities/audit.entity';
@Entity('inventory_document')
export class InventoryDocument extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) inventoryDocumentId: string;
  @Column({ type: 'varchar', length: 50 }) documentNo: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  // inventory.constant.ts와 프런트 inventory.api.ts의 계약을 함께 수정한다.
  @Column({ type: 'varchar', length: 10 }) type: 'IN' | 'OUT' | 'ADJUST';
  @Column({ type: 'varchar', length: 10, nullable: true }) kind:
    'GENERAL' | 'PURCHASE' | 'TRANSFER' | null;
  @Column({ type: 'char', length: 8 }) postingDate: string;
  @Column({ type: 'varchar', length: 30 }) siteId: string;
  @Column({ type: 'varchar', length: 30 }) warehouseId: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) deptId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) toSiteId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) toWarehouseId:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) refModule:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) refId: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'text', nullable: true }) reason: string | null;
  @Column({ type: 'text', nullable: true }) note: string | null;
  @Column({ type: 'char', length: 1, default: 'C' }) status: InventoryStatus;
  @Column({ type: 'varchar', length: 50, nullable: true }) confirmedBy:
    string | null;
  @Column({ type: 'timestamptz', nullable: true }) confirmedAt: Date | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) cancelledBy:
    string | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelledAt: Date | null;
  @Column({ type: 'text', nullable: true }) cancelReason: string | null;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
  @Column({ type: 'bigint', nullable: true }) postingSequence: string | null;
}
