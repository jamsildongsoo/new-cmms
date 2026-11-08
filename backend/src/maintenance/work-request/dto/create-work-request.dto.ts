import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
export class CreateWorkRequestDto {
  @IsOptional() @IsString() @MaxLength(50) workRequestId: string;
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsString() @IsNotEmpty() @MaxLength(50) equipmentId: string;
  @Matches(/^\d{8}$/) occurredDate: string;
  @IsString() @IsNotEmpty() content: string;
  @IsOptional() @IsString() @MaxLength(50) priorityCode?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
