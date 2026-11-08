import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../common/entities/audit.entity';

// 게시글에는 결재 상태가 없다. 회사와 작성자로 조회/변경 범위를 결정한다.
@Entity('board')
export class Board extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) boardId: string;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'varchar', length: 50, nullable: true }) attachmentId:
    string | null;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
