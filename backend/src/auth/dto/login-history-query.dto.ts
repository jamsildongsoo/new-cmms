import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export class LoginHistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString({}, { message: '시작일을 확인해 주세요.' })
  from?: string;
  @IsOptional()
  @IsDateString({}, { message: '종료일을 확인해 주세요.' })
  to?: string;
  @IsOptional() @IsIn(['success', 'failure']) result?: 'success' | 'failure';
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50)
  userId?: string;
  @IsOptional() @Max(100) declare limit?: number;
}
