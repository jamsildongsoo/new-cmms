import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
  ArrayUnique,
  IsIn,
} from 'class-validator';
import { PurchaseDocumentFieldsDto } from '../../common/purchase-document.dto';
export class PurchaseOrderItemFieldsDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() note?: string | null;
}
export class PurchaseOrderItemDto extends PurchaseOrderItemFieldsDto {
  @IsOptional() @IsString() unitPrice?: string | null;
}
export class PurchaseOrderSaveDto extends PurchaseDocumentFieldsDto {
  @IsOptional() @Matches(/^\d{8}$/) orderDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) expectedDeliveryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(50) vendorId?: string | null;
  @IsOptional() @IsString() @MaxLength(300) deliveryLocation?: string | null;
  @IsOptional() @IsIn(['KRW']) currency?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  requestIds?: string[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
