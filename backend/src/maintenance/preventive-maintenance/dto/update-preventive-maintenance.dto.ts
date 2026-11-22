import { Type } from 'class-transformer';
import {
  ValidateIf,
  IsArray,
  ValidateNested,
  MaxLength,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { InspectionItemDto } from './inspection-item.dto';

export class UpdatePreventiveMaintenanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  equipmentId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: '점검일을 입력해 주세요.' })
  @Matches(/^\d{8}$/)
  inspectionDate?: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  nextInspectionDate?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items?: InspectionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  typeCode?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  attachmentId?: string | null;
  @IsOptional()
  @IsIn(['OK', 'NOK'])
  result?: 'OK' | 'NOK' | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  // frontend/src/modules/maintenance/preventive-maintenance/preventiveMaintenance.api.ts와 함께 수정한다.
  deptId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  inspectorId?: string | null;
}
