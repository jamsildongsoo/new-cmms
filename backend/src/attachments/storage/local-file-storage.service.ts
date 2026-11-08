/** 서버 업로드 루트 안의 상대 경로만 허용하여 로컬 파일을 저장·조회·삭제한다. */
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { FileStorage, StoredFile, StoredFileResult } from './storage.types';

@Injectable()
export class LocalFileStorageService implements FileStorage {
  constructor(private readonly configService: ConfigService) {}

  async save(file: StoredFile, storagePath: string): Promise<StoredFileResult> {
    const absolutePath = this.path(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      storageName: storagePath.split('/').at(-1) ?? storagePath,
      storagePath,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(this.path(storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    await rm(this.path(storagePath), { force: true });
  }

  private path(storagePath: string): string {
    const root = resolve(
      this.configService.getOrThrow<string>('storage.localRoot'),
    );
    if (
      !storagePath ||
      isAbsolute(storagePath) ||
      storagePath.includes('\\') ||
      storagePath.split('/').some((part) => part === '.' || part === '..')
    )
      throw new BadRequestException('Invalid storage path');
    const absolute = resolve(root, storagePath);
    const within = relative(root, absolute);
    if (
      !within ||
      within === '..' ||
      within.startsWith(`..${sep}`) ||
      isAbsolute(within)
    ) {
      throw new BadRequestException('Invalid storage path');
    }
    return absolute;
  }
}
