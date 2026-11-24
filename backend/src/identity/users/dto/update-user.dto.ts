import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { AccessScope } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

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

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  siteId?: string | null;

  @IsOptional()
  @IsString()
  deptId?: string | null;

  @IsOptional()
  @IsIn(Object.values(AccessScope))
  accessScope?: AccessScope;
}
