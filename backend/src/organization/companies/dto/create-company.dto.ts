import { IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
