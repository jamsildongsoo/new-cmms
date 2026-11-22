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
  @MaxLength(50)
  equipmentId: string;

  @IsString()
  @MaxLength(30)
  siteId: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(50)
  typeCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  maker?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @IsString()
  spec?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNo?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  installDate?: string | null;

  @IsString()
  @MaxLength(30)
  deptId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inspectionPeriod?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
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
  @MaxLength(20)
  legalInspectionUnit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
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
