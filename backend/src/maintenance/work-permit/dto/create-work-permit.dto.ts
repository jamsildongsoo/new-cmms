import { IsOptional, MaxLength, IsString } from 'class-validator';


import { SaveWorkPermitDto } from './permit-data.dto';
export class CreateWorkPermitDto extends SaveWorkPermitDto {
  @IsOptional() @IsString() @MaxLength(50) workPermitId: string;
}
