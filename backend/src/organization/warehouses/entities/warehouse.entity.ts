import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('warehouse')
export class Warehouse extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  warehouseId: string;

  // 창고번호는 사업장 내에서 유일하며 등록 후 사업장을 바꾸지 않는다.
  @PrimaryColumn({ type: 'varchar', length: 30 })
  siteId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
