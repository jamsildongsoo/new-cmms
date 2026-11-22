import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApprovalStepInputDto } from './approval-step-input.dto';

export class UpdateApprovalDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '제목은 200자 이내로 입력해 주세요.' })
  title?: string;

  @IsOptional()
  contentJson?: unknown;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepInputDto)
  steps?: ApprovalStepInputDto[];
}
