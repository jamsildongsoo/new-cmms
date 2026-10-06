import { IsString } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  permissionId: string;

  @IsString()
  module: string;

  @IsString()
  action: string;

  @IsString()
  name: string;
}
