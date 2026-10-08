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
}
