import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../../common/entities/audit.entity';
import { PermitDataDto } from '../../work-permit/dto/permit-data.dto';
@Entity('work_permit_request')
export class WorkPermitRequest extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) workPermitRequestId: string;
  @Column({ type: 'varchar', length: 50 }) documentNo: string;
  @Column({ type: 'jsonb' }) data: PermitDataDto;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) siteId:
    string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) deptId:
    string | null;
  @Column({ type: 'char', length: 1, default: 'D' }) status: string;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
