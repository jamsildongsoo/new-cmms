import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  companyId: string;

  @IsString()
  userId: string;

  @IsString()
  password: string;
}
