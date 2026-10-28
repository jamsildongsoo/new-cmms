import { IsIn, IsString } from 'class-validator';
import { ApprovalStepType } from '../entities/approval-step.entity';

export class ApprovalStepInputDto {
  @IsIn(Object.values(ApprovalStepType))
  type: ApprovalStepType;

  @IsString()
  userId: string;
}
