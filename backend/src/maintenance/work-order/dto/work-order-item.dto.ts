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
// 기존 JSON의 재저장을 위해 DTO 정밀도는 유지하고, 신규·변경 값의 공통 자릿수는 서비스에서 검사한다.
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
