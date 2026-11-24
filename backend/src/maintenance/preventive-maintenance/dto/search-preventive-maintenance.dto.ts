import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

// API 계약: frontend/src/modules/maintenance/preventive-maintenance/preventiveMaintenance.api.ts와 함께 수정한다.
export class SearchPreventiveMaintenanceDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['pmId', 'documentNo', 'title', 'equipmentId', 'createdBy'])
  searchType?: 'pmId' | 'documentNo' | 'title' | 'equipmentId' | 'createdBy';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
