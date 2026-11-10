import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PurchaseDocumentFieldsDto } from '../../common/purchase-document.dto';
export class PurchaseRequestItemDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() note?: string | null;
}
export class PurchaseRequestSaveDto extends PurchaseDocumentFieldsDto {
  @IsOptional() @Matches(/^\d{8}$/) requestDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) requiredDate?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
