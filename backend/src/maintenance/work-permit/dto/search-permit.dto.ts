import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
// API 계약: frontend/src/modules/maintenance/work-permit/permit.api.ts와 함께 수정한다.
export class SearchPermitDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
