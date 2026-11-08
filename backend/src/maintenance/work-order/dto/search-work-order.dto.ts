import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { OrderKind } from '../entities/work-order.entity';
import type { DocumentStatus } from '../../../common/constants/document-status';
export class SearchWorkOrderDto {
  @IsOptional()
  @IsIn(['PLAN', 'ACTUAL'])
  orderKind?: OrderKind;
  @IsOptional()
  @IsIn(['D', 'P', 'C', 'R', 'X'])
  status?: DocumentStatus;
  @IsOptional()
  @IsIn(['title', 'documentNo', 'equipmentId'])
  searchType?: 'title' | 'documentNo' | 'equipmentId';
  @IsOptional()
  @IsString()
  searchVal?: string;
  @IsOptional()
  @Matches(/^\d{8}$/)
  workDateFrom?: string;
  @IsOptional()
  @Matches(/^\d{8}$/)
  workDateTo?: string;
}
