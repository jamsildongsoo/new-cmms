import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('code_item')
export class CodeItem {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  codeId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  codeItemId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

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
