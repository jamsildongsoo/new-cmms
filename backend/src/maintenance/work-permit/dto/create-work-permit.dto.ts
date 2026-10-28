import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateWorkPermitDto {
  @IsUUID()
  workPermitId: string;

  @IsString()
  @IsNotEmpty()
  documentNo: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @Matches(/^\d{8}$/)
  workDate: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsString()
  supervisor?: string | null;

  @IsOptional()
  @IsString()
  equipmentText?: string | null;

  @IsOptional()
  @IsString()
  workSummary?: string | null;

  @IsOptional()
  @IsString()
  riskFactor?: string | null;

  @IsOptional()
  @IsString()
  safetyAction?: string | null;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
