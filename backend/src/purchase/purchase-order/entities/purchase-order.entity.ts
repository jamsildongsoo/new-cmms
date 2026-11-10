import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../../common/constants/document-status';
import { AuditEntity } from '../../../common/entities/audit.entity';

@Entity('purchase_order')
export class PurchaseOrder extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  // 최초 저장 시 서버에서 공통 채번하며 이후 변경하지 않는 문서 ID.
  @PrimaryColumn({ type: 'varchar', length: 50 })
  orderId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vendorId: string | null;

  @Column({ type: 'varchar', length: 50 })
  documentNo: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  typeCode: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  expectedDeliveryDate: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'varchar', length: 50 })
  requesterId: string;

  @Column({ type: 'char', length: 1, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  deptId: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  orderDate: string | null;

  @Column({ type: 'numeric', precision: 24, scale: 0, default: 0 })
  totalAmount: string;

  @Column({ type: 'varchar', length: 300, nullable: true }) deliveryLocation:
    string | null;
  @Column({ type: 'varchar', length: 3, default: 'KRW' }) currency: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  sourceRequestIds: string[];
}
