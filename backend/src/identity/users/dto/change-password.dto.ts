import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: '현재 비밀번호를 입력해 주세요.' })
  @IsNotEmpty({ message: '현재 비밀번호를 입력해 주세요.' })
  @MaxLength(255)
  currentPassword: string;

  @IsString({ message: '새 비밀번호를 입력해 주세요.' })
  @MinLength(10, { message: '새 비밀번호는 10자 이상이어야 합니다.' })
  @MaxLength(72, { message: '새 비밀번호는 72바이트 이내여야 합니다.' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[\s\S]+$/, {
    message: '새 비밀번호에는 영문과 숫자를 포함해 주세요.',
  })
  newPassword: string;
}
