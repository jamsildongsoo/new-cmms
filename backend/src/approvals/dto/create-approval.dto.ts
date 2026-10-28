import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApprovalStepInputDto } from './approval-step-input.dto';

export class CreateApprovalDto {
  @IsOptional()
  @IsUUID()
  approvalId?: string;

  @IsOptional()
  @IsString()
  refModule?: string | null;

  @IsOptional()
  @IsUUID()
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
