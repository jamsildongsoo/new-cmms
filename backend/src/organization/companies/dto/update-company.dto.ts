import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  registrationNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
