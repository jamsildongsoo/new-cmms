import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  deptId: string;

  @IsOptional()
  @IsString()
  siteId?: string | null;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  parentDeptId?: string | null;
}
