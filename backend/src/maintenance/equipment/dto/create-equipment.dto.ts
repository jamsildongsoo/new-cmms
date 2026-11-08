import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  IsIn,
  MaxLength,
} from 'class-validator';

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
  inspectionPeriod?: number | null;

  @IsOptional()
  @IsString()
  inspectionUnit?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  inspectionDate?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  nextInspectionDate?: string | null;

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
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentEquipmentId?: string | null;

  @IsOptional()
  @IsIn(['Y', 'N'])
  pmTargetYn?: string;

  @IsOptional()
  @IsIn(['Y', 'N'])
  permitTargetYn?: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  legalInspectionDate?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  legalNextInspectionDate?: string | null;
}
