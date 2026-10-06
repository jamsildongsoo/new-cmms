import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('attachment_item')
export class AttachmentItem {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  companyId: string;

  @PrimaryColumn({ type: 'varchar', length: 50 })
  attachmentId: string;

  @PrimaryColumn({ type: 'integer' })
  itemNo: number;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 255 })
  storageName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fileExtension: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'bigint' })
  size: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum: string | null;

  @Column({ type: 'varchar', length: 500 })
  storagePath: string;
}
