import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../../common/constants/document-status';
import { AuditEntity } from '../../../common/entities/audit.entity';

export type OrderKind = 'PLAN' | 'ACTUAL';
export interface LaborItem {
  workerName: string;
  content: string;
  hours: number;
}
export interface MaterialItem {
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}
export interface CostItem {
  name: string;
  amount: number;
  note: string;
}

@Entity('work_order')
export class WorkOrder extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  // 계획과 실적마다 서버에서 별도 문서 ID를 채번하며 결재는 이 ID로 원본을 참조한다.
  @PrimaryColumn({ type: 'varchar', length: 50 })
  workOrderId: string;

  @Column({ type: 'varchar', length: 50 })
  documentNo: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 10 })
  orderKind: OrderKind;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refModule: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  refId: string | null;

  // 작성 당시 소속을 보존한다. 사용자나 설비의 소속 변경을 소급하지 않는다.
  @Column({ type: 'varchar', length: 30, nullable: true })
  siteId: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  deptId: string | null;

  @Column({ type: 'varchar', length: 50 })
  equipmentId: string;

  @Column({ type: 'char', length: 8 })
  workDate: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  typeCode: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  // 각 배열은 문서의 입력 행 순서대로 헤더와 함께 저장한다. 자재는 기록용이다.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  laborItems: LaborItem[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  materials: MaterialItem[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  costItems: CostItem[];

  @Column({ type: 'varchar', length: 50 })
  requesterId: string;

  @Column({ type: 'char', length: 1, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  // 원본이 첨부 그룹을 소유하고 연계 결재는 같은 ID를 조회만 한다.
  @Column({ type: 'varchar', length: 50, nullable: true })
  attachmentId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'char', length: 1, default: 'N' })
  deleteYn: string;
}
