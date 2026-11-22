import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

const normalize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;
export class UpdateProfileDto {
  @Transform(normalize)
  @IsOptional()
  @IsEmail({}, { message: '올바른 이메일 주소를 입력해 주세요.' })
  @MaxLength(255, { message: '이메일은 255자 이내로 입력해 주세요.' })
  email?: string | null;

  @Transform(normalize)
  @IsOptional()
  @IsString({ message: '전화번호를 확인해 주세요.' })
  @MaxLength(50, { message: '전화번호는 50자 이내로 입력해 주세요.' })
  phoneNumber?: string | null;
}
