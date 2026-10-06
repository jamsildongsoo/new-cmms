import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export type EquipmentSearchType = 'equipmentId' | 'name' | 'typeCode';

export class SearchEquipmentDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['equipmentId', 'name', 'typeCode'])
  searchType?: EquipmentSearchType;

  @IsOptional()
  @IsString()
  searchVal?: string;
}
