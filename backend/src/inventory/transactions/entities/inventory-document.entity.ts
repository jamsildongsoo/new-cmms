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
