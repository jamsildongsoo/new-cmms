import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { DocumentStatus } from '../../../common/constants/document-status';
export class SearchWorkRequestDto {
  @IsOptional() @IsIn(['D', 'P', 'C', 'R', 'X']) status?: DocumentStatus;
  @IsOptional() @IsString() priorityCode?: string;
  @IsOptional() @IsIn(['title', 'documentNo', 'equipmentId']) searchType?:
    'title' | 'documentNo' | 'equipmentId';
  @IsOptional() @IsString() searchVal?: string;
  @IsOptional() @Matches(/^\d{8}$/) occurredDateFrom?: string;
  @IsOptional() @Matches(/^\d{8}$/) occurredDateTo?: string;
}
