import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class SaveBoardDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(50000) content: string;
  @IsOptional() @IsUUID() attachmentId?: string | null;
}
export class SaveCommentDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) content: string;
}
export class SearchBoardDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
