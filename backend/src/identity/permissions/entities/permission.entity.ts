import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('permission')
export class Permission {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  permissionId: string;

  @Column({ type: 'varchar', length: 50 })
  module: string;

  @Column({ type: 'varchar', length: 30 })
  action: string;

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
