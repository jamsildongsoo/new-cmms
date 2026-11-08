import { Column, Entity, PrimaryColumn } from 'typeorm';

// 저장 응답 유실 후에도 같은 생성 요청은 같은 업무 문서 ID를 사용한다.
@Entity('document_request')
export class DocumentRequest {
  @PrimaryColumn({ type: 'varchar', length: 30 }) companyId: string;
  @PrimaryColumn({ type: 'varchar', length: 50 }) moduleKey: string;
  @PrimaryColumn({ type: 'varchar', length: 36 }) requestKey: string;
  @Column({ type: 'varchar', length: 50 }) documentId: string;
  @Column({ type: 'varchar', length: 50 }) userId: string;
  @Column({ type: 'boolean', default: false }) completed: boolean;
  @Column({ type: 'boolean', default: false }) processing: boolean;
}
