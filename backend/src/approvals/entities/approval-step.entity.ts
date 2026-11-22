import { Column, Entity, PrimaryColumn } from 'typeorm';

import { ApprovalStepType, ApprovalStepResult } from '../approval.constant';

@Entity('approval_step')
export class ApprovalStep {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  approvalId: string;

  @PrimaryColumn({ type: 'integer' })
  stepNo: number;

  @Column({ type: 'varchar', length: 30 })
  type: ApprovalStepType;

  @Column({ type: 'varchar', length: 50 })
  userId: string;

  @Column({ type: 'char', length: 1, nullable: true })
  status: ApprovalStepResult | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  actedAt: Date | null;
}
