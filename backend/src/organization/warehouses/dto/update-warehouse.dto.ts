import { IsOptional, IsString } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  siteId?: string | null;

  @IsOptional()
  @IsString()
  name?: string;
}
