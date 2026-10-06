import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('equipment')
export class Equipment {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @Column({ type: 'varchar', length: 30 })
  siteId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  equipmentId: string;

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
  period: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

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

  @Column({ type: 'varchar', length: 50 })
  createdBy: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  updatedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
