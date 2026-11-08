import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InspectionItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(500)
  standardValue: string;

  @IsString()
  @MaxLength(500)
  inspectionValue: string;

  @IsString()
  @MaxLength(50)
  unit: string;
}
