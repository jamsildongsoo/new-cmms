import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApprovalStepInputDto } from './approval-step-input.dto';

export class UpdateApprovalDto {
  @IsOptional()
  @IsString()
  refModule?: string | null;

  @IsOptional()
  @IsUUID()
  refId?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  contentJson?: unknown;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepInputDto)
  steps?: ApprovalStepInputDto[];
}
