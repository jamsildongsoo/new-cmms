import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { FileStorage, StoredFile, StoredFileResult } from './storage.types';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  constructor(private readonly configService: ConfigService) {}

  async save(file: StoredFile, storagePath: string): Promise<StoredFileResult> {
    const localRoot =
      this.configService.getOrThrow<string>('storage.localRoot');
    const absolutePath = join(localRoot, storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      storageName: storagePath.split('/').at(-1) ?? storagePath,
      storagePath,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const localRoot =
      this.configService.getOrThrow<string>('storage.localRoot');
    return readFile(join(localRoot, storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    const localRoot =
      this.configService.getOrThrow<string>('storage.localRoot');
    await rm(join(localRoot, storagePath), { force: true });
  }
}
