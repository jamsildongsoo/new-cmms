import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// API 계약: frontend/src/modules/maintenance/work-request의 목록 검색 타입과 함께 수정한다.
export class SearchWorkRequestDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
