import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreatePreventiveMaintenanceDto {
  @IsUUID()
  pmId: string;

  @IsString()
  @IsNotEmpty()
  documentNo: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  equipmentId: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  plannedDate?: string | null;

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
