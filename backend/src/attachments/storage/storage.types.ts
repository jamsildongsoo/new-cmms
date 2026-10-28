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

export interface FileStorage {
  save(file: StoredFile, storagePath: string): Promise<StoredFileResult>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
