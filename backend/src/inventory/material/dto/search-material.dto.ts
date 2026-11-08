import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
export class SearchMaterialDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['materialId', 'name', 'typeCode']) searchType?:
    'materialId' | 'name' | 'typeCode';
  @IsOptional() @IsString() @MaxLength(200) searchVal?: string;
}
