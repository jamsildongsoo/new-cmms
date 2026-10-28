import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { AccessScope } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  userId: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  position?: string | null;

  @IsString()
  roleId: string;

  @IsString()
  deptId: string;

  @IsIn(Object.values(AccessScope))
  accessScope: AccessScope;
}
