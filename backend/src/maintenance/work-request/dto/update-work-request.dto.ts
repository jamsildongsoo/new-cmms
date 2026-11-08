import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
export class UpdateWorkRequestDto {
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(50) equipmentId?: string;
  @IsOptional() @Matches(/^\d{8}$/) occurredDate?: string;
  @IsOptional() @IsString() @IsNotEmpty() content?: string;
  @IsOptional() @IsString() @MaxLength(50) priorityCode?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
