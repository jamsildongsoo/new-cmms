import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApprovalStepInputDto } from './approval-step-input.dto';

export class CreateApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  approvalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNo?: string;

  @IsOptional()
  @IsString()
  refModule?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refId?: string | null;

  @IsString()
  title: string;

  @IsDefined()
  contentJson: unknown;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepInputDto)
  steps: ApprovalStepInputDto[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
