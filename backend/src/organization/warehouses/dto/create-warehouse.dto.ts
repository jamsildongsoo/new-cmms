import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class CreateWarehouseDto {
  @IsString() @IsNotEmpty() @MaxLength(30) warehouseId: string;
  @IsString() @IsNotEmpty() @MaxLength(30) siteId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
}
