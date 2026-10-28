import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWorkPermitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  documentNo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @Matches(/^\d{8}$/)
  workDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  startTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endTime?: string;

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
