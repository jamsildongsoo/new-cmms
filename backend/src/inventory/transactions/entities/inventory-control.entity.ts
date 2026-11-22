import { Column, Entity, PrimaryColumn } from 'typeorm';
/** 회사별 재고 확정순번. InventoryService가 확정할 때 증가시키며 문서번호 채번과는 별개다. */
@Entity('inventory_control')
export class InventoryControl {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @Column({ type: 'bigint', default: 0 }) lastSequence: string;
}
