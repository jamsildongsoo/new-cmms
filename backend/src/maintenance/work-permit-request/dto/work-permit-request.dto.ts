import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PermitDataDto } from '../../work-permit/dto/permit-data.dto';
export class SavePermitRequestDto {
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsDefined() @ValidateNested() @Type(() => PermitDataDto) data: PermitDataDto;
  @IsOptional() @IsString() attachmentId?: string | null;
}
export class CreatePermitRequestDto extends SavePermitRequestDto {
  @IsOptional() @IsString() @MaxLength(50) workPermitRequestId: string;
}
