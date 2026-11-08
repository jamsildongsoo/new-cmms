import { IsOptional } from 'class-validator';
import { MaxLength } from 'class-validator';
import { IsString } from 'class-validator';
import { SaveWorkPermitDto } from './permit-data.dto';
export class CreateWorkPermitDto extends SaveWorkPermitDto {
  @IsOptional() @IsString() @MaxLength(50) workPermitId: string;
}
