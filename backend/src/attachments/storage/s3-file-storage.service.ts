import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { FileStorage, StoredFile, StoredFileResult } from './storage.types';

@Injectable()
export class S3FileStorageService implements FileStorage {
  private client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  async save(file: StoredFile, storagePath: string): Promise<StoredFileResult> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.configService.getOrThrow<string>('storage.minio.bucket'),
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimeType ?? undefined,
      }),
    );

    return {
      storageName: storagePath.split('/').at(-1) ?? storagePath,
      storagePath,
    };
  }

  async read(storagePath: string): Promise<Buffer> {
    const response = await this.getClient().send(
      new GetObjectCommand({
        Bucket: this.configService.getOrThrow<string>('storage.minio.bucket'),
        Key: storagePath,
      }),
    );

    if (!response.Body) {
      return Buffer.alloc(0);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  async delete(storagePath: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.configService.getOrThrow<string>('storage.minio.bucket'),
        Key: storagePath,
      }),
    );
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private getClient(): S3Client {
    this.client ??= new S3Client({
      endpoint: this.configService.getOrThrow<string>('storage.minio.endpoint'),
      region: this.configService.getOrThrow<string>('storage.minio.region'),
      forcePathStyle: this.configService.getOrThrow<boolean>(
        'storage.minio.forcePathStyle',
      ),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>(
          'storage.minio.accessKey',
        ),
        secretAccessKey: this.configService.getOrThrow<string>(
          'storage.minio.secretKey',
        ),
      },
    });

    return this.client;
  }
}
