import { AuditEntity } from '../../../common/entities/audit.entity';
import { Column, Entity, PrimaryColumn, Index } from 'typeorm';

@Index(['companyId', 'parentEquipmentId'])
@Entity('equipment')
export class Equipment extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @Column({ type: 'varchar', length: 30 })
  siteId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  equipmentId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  parentEquipmentId: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  pmTargetYn: string;

  @Column({ type: 'char', length: 1, default: 'N' })
  permitTargetYn: string;

  @Column({ type: 'char', length: 8, nullable: true })
  legalInspectionDate: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  legalNextInspectionDate: string | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  typeCode: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  maker: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'text', nullable: true })
  spec: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNo: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  installDate: string | null;

  @Column({ type: 'varchar', length: 30 })
  deptId: string;

  @Column({ type: 'integer', nullable: true })
  inspectionPeriod: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  inspectionUnit: string | null;

  // PM 완결 시 해당 문서에 저장된 날짜로 갱신한다. 주기가 없으면 다음 점검일은 비워 둔다.
  @Column({ type: 'char', length: 8, nullable: true })
  inspectionDate: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  nextInspectionDate: string | null;

  @Column({ type: 'integer', nullable: true })
  legalInspectionPeriod: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  legalInspectionUnit: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
