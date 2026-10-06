import { IsOptional, IsString } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsString()
  siteId?: string | null;

  @IsString()
  name: string;
}
