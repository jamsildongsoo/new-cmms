import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApprovalStepType } from '../approval.constant';

export class ApprovalStepInputDto {
  @IsIn(
    [
      ApprovalStepType.APPROVER,
      ApprovalStepType.AGREE,
      ApprovalStepType.REFERENCE,
    ],
    { message: '결재선 유형은 결재·합의·참조 중에서 선택해 주세요.' },
  )
  type: ApprovalStepType;

  @IsString()
  @IsNotEmpty({ message: '결재선 사용자를 지정해 주세요.' })
  @MaxLength(50)
  userId: string;
}
