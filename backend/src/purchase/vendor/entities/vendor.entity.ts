import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';

// 거래처는 회사 공통 구매 기준정보이며 조직/사업장에 종속되지 않는다.
@Entity('vendor')
export class Vendor extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  vendorId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  representativeName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
