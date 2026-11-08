import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

// 원본 문서 식별 정보만 입력받고 회사·첨부 UUID·작성자는 서버에서 결정한다.
export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  refModule: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refId?: string | null;
}
