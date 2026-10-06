import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('number_sequence')
export class NumberSequence {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  moduleCode: string;

  @PrimaryColumn({ type: 'char', length: 6 })
  yyyymm: string;

  @Column({ type: 'integer', default: 0 })
  lastSerial: number;
}
