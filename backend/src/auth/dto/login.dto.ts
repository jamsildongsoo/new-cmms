import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  companyId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  userId: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
