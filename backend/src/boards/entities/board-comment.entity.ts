import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditEntity } from '../../common/entities/audit.entity';

@Entity('board_comment')
export class BoardComment extends AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) boardId: string;
  // 댓글은 사용자 문서번호가 아닌 내부 UUID를 사용한다.
  @PrimaryColumn({ type: 'varchar', length: 36 }) commentId: string;
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'char', length: 1, default: 'N' }) deleteYn: string;
}
