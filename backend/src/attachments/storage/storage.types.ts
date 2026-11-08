export interface StoredFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string | null;
  size: number;
}

export interface StoredFileResult {
  storageName: string;
  storagePath: string;
}

// 첨부 서비스가 저장 방식에 의존하지 않도록 파일 저장·읽기·삭제 규약을 정의한다.
export interface FileStorage {
  save(file: StoredFile, storagePath: string): Promise<StoredFileResult>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
