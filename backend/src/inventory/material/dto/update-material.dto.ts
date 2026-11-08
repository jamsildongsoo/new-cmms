import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(50) typeCode?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(30) baseUnit?: string;
  @IsOptional() @IsString() spec?: string | null;
  @IsOptional() @IsString() @MaxLength(100) maker?: string | null;
  @IsOptional() @IsString() @MaxLength(100) model?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
}
