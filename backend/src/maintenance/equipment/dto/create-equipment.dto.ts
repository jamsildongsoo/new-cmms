import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateEquipmentDto {
  @IsString()
  equipmentId: string;

  @IsString()
  siteId: string;

  @IsString()
  name: string;

  @IsString()
  typeCode: string;

  @IsOptional()
  @IsString()
  location?: string | null;

  @IsOptional()
  @IsString()
  maker?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @IsString()
  serialNo?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  installDate?: string | null;

  @IsString()
  deptId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  period?: number | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  legalInspectionPeriod?: number | null;

  @IsOptional()
  @IsString()
  legalInspectionUnit?: string | null;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
