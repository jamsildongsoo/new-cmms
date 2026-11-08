import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class LaborItemDto {
  @IsString()
  @MaxLength(100)
  workerName: string;
  @IsOptional()
  @IsString()
  content?: string;
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  hours: number;
}
export class MaterialItemDto {
  @IsString()
  @MaxLength(150)
  name: string;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string;
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  quantity: number;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;
}
export class CostItemDto {
  @IsString()
  @MaxLength(150)
  name: string;
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  amount: number;
  @IsOptional()
  @IsString()
  note?: string;
}
