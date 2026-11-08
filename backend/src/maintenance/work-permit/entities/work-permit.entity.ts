import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';
import { DocumentStatus } from '../../../common/constants/document-status';
import { PermitDataDto, DocumentFileDto } from '../dto/permit-data.dto';
import { PermitSection, PermitType } from '../permit-template';
@Entity('work_permit')
export class WorkPermit extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) workPermitId: string;
  @Column({ type: 'varchar', length: 50 }) documentNo: string;
  @Column({ type: 'jsonb' }) data: PermitDataDto;
  @Column({ type: 'varchar', length: 50, nullable: true }) refModule:
    string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) refId: string | null;
  @Column({ type: 'jsonb' }) permitTypes: PermitType[];
  @Column({ type: 'jsonb' }) sections: PermitSection[];
  @Column({ type: 'varchar', length: 50 }) issuerId: string;
  @Column({ type: 'varchar', length: 50 }) approverId: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  documentFiles: DocumentFileDto[];
  @Column({ type: 'varchar', length: 30, nullable: true }) siteId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) deptId:
    string | null;
  @Column({ type: 'char', length: 1, default: 'D' }) status: DocumentStatus;
  @Column({ type: 'varchar', length: 50, nullable: true }) approvalId:
    string | null;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
