import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
// API 계약: frontend/src/modules/purchase/common/purchase.types.ts와 함께 수정한다.
export class PurchaseSearchDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['id', 'documentNo', 'title', 'createdBy']) searchType?: 'id' | 'documentNo' | 'title' | 'createdBy';
  @IsOptional() @IsString() search?: string;
}
