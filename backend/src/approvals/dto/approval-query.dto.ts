import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const APPROVAL_SEARCH_TYPES = [
  'approvalId',
  'documentNo',
  'title',
  'submitterId',
] as const;

export class ApprovalQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(APPROVAL_SEARCH_TYPES)
  searchType?: (typeof APPROVAL_SEARCH_TYPES)[number];
}
