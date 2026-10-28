import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePurchaseRequestDto {
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
  typeCode?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  requiredDate?: string | null;

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
