import { Type } from 'class-transformer';
import { IsArray, ValidateNested, MaxLength, IsIn } from 'class-validator';
import { InspectionItemDto } from './inspection-item.dto';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePreventiveMaintenanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pmId: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNo?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  equipmentId: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  inspectionDate?: string | null;

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
  inspectionDeptId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  inspectorId?: string | null;
}
