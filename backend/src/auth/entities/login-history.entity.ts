import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('login_history')
@Index(['companyId', 'attemptedAt'])
@Index(['companyId', 'userId', 'attemptedAt'])
export class LoginHistory {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @Column({ type: 'varchar', length: 50 }) userId: string;
  @Column({ type: 'boolean' }) success: boolean;
  @Column({ type: 'varchar', length: 40, nullable: true }) failureReason:
    string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ipAddress:
    string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) userAgent:
    string | null;
  @CreateDateColumn({ type: 'timestamptz' }) attemptedAt: Date;
}
