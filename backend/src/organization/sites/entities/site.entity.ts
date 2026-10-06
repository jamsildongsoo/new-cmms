import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('site')
export class Site {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 30 })
  siteId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

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
