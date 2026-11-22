import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { PurchaseDocumentFieldsDto } from '../../common/purchase-document.dto';
export class PurchaseOrderItemFieldsDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() spec?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
export class PurchaseOrderItemDto extends PurchaseOrderItemFieldsDto {
  @IsOptional() @IsString() unitPrice?: string | null;
}
export class PurchaseOrderSaveDto extends PurchaseDocumentFieldsDto {
  @IsString() @IsNotEmpty() @MaxLength(30) toSiteId: string;
  @IsOptional() @Matches(/^\d{8}$/) orderDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) expectedDeliveryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(50) vendorId?: string | null;
  @IsOptional() @IsString() @MaxLength(300) deliveryLocation?: string | null;
  @IsOptional() @IsIn(['KRW']) currency?: string;
  // frontend/src/modules/purchase/purchase-order/purchase-order.api.ts와 함께 수정한다.
  @IsOptional() @IsIn(['PURREQ']) refModule?: string | null;
  @IsOptional() @IsString() @MaxLength(50) refId?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
