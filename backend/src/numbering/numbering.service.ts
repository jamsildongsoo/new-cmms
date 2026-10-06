import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DocumentModuleCode } from '../common/constants/modules';
import { NumberSequence } from './entities/number-sequence.entity';

export interface GenerateDocumentNoInput {
  companyId: string;
  moduleCode: DocumentModuleCode;
  date?: Date | string;
}

@Injectable()
export class NumberingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async generateDocumentNo(input: GenerateDocumentNoInput): Promise<string> {
    const companyId = this.requireTrimmedString(input.companyId, 'companyId');
    const moduleCode = this.requireTrimmedString(
      input.moduleCode,
      'moduleCode',
    );
    const yyyymm = this.toYearMonth(input.date ?? new Date());
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(NumberSequence)
        .values({
          companyId,
          moduleCode,
          yyyymm,
          lastSerial: 0,
        })
        .orIgnore()
        .execute();

      const sequence = await queryRunner.manager.findOne(NumberSequence, {
        where: {
          companyId,
          moduleCode,
          yyyymm,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!sequence) {
        throw new Error('Number sequence was not created');
      }

      sequence.lastSerial += 1;
      await queryRunner.manager.save(sequence);
      await queryRunner.commitTransaction();

      return this.formatDocumentNo(
        companyId,
        moduleCode,
        yyyymm,
        sequence.lastSerial,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private toYearMonth(value: Date | string): string {
    if (value instanceof Date) {
      return `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, '0')}`;
    }

    const compactValue = value.replaceAll('-', '').slice(0, 6);
    if (!/^\d{6}$/.test(compactValue)) {
      throw new Error('date must produce YYYYMM');
    }

    return compactValue;
  }

  private formatDocumentNo(
    companyId: string,
    moduleCode: string,
    yyyymm: string,
    serial: number,
  ): string {
    return `${companyId}-${moduleCode}-${yyyymm}-${String(serial).padStart(5, '0')}`;
  }

  private requireTrimmedString(value: string, fieldName: string): string {
    if (value.trim() === '') {
      throw new Error(`${fieldName} is required`);
    }
    return value.trim();
  }
}
