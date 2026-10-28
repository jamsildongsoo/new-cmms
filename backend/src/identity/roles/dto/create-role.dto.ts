import { IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  roleId: string;

  @IsString()
  name: string;
}
