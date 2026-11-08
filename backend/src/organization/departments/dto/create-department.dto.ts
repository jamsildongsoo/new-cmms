import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  deptId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  parentDeptId?: string | null;
}
