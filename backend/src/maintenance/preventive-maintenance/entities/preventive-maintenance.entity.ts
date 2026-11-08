import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DocumentStatus } from '../../../common/constants/document-status';
import { AuditEntity } from '../../../common/entities/audit.entity';

export interface InspectionItem {
  name: string;
  standardValue: string;
  inspectionValue: string;
  unit: string;
}

@Entity('preventive_maintenance')
export class PreventiveMaintenance extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  // 최초 저장 시 서버에서 채번하며 결재 원본 참조에도 사용하는 문서 ID다.
  @PrimaryColumn({ type: 'varchar', length: 50 })
  pmId: string;

  @Column({ type: 'varchar', length: 50 })
  documentNo: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 50 })
  equipmentId: string;

  @Column({ type: 'char', length: 8, nullable: true })
  inspectionDate: string | null;

  @Column({ type: 'char', length: 8, nullable: true })
  nextInspectionDate: string | null;

  // 상세는 헤더와 함께 저장하며 판정·비고 없이 네 항목만 관리한다.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  items: InspectionItem[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  typeCode: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  result: 'OK' | 'NOK' | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  inspectionDeptId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  inspectorId: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

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
