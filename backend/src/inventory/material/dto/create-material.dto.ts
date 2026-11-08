import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaterialDto {
  @IsString() @IsNotEmpty() @MaxLength(50) materialId: string;
  @IsString() @IsNotEmpty() @MaxLength(150) name: string;
  @IsString() @IsNotEmpty() @MaxLength(50) typeCode: string;
  @IsString() @IsNotEmpty() @MaxLength(30) baseUnit: string;
  @IsOptional() @IsString() spec?: string | null;
  @IsOptional() @IsString() @MaxLength(100) maker?: string | null;
  @IsOptional() @IsString() @MaxLength(100) model?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
}
