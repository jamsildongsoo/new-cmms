import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApprovalStepInputDto } from './approval-step-input.dto';

export class CreateApprovalDto {
  @IsOptional()
  @IsString()
  refModule?: string | null;

  @IsOptional()
  @IsString()
  refNo?: string | null;

  @IsString()
  title: string;

  @IsDefined()
  contentJson: unknown;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepInputDto)
  steps: ApprovalStepInputDto[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
