import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  documentNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  equipmentId?: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  workDate?: string;

  @IsOptional()
  @IsString()
  typeCode?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
