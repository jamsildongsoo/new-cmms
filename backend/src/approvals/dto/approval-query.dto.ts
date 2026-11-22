import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { DocumentStatus } from '../../common/constants/document-status';

export class ApprovalQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(DocumentStatus))
  status?: DocumentStatus;
}
