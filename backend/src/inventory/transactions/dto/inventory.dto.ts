import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
export class InventoryItemDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() unitPrice?: string;
  @IsOptional() @IsString() @MaxLength(50) refItemId?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
export class SaveInventoryDto {
  @IsOptional() @IsString() @MaxLength(50) inventoryDocumentId?: string;
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsString() @MaxLength(200) title: string;
  @IsString() @MaxLength(50) typeCode: string;
  @Matches(/^\d{8}$/) postingDate: string;
  @IsString() @MaxLength(30) siteId: string;
  @IsString() @MaxLength(30) warehouseId: string;
  @IsOptional() @IsString() @MaxLength(30) deptId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) toSiteId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) toWarehouseId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) toDeptId?: string | null;
  @IsOptional() @IsIn(['purchase_order', 'inventory_document']) refModule?:
    string | null;
  @IsOptional() @IsString() @MaxLength(50) refId?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
  @IsOptional() @IsString() reason?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemDto)
  items: InventoryItemDto[];
}
export class InventorySearchDto {
  @IsOptional() @IsString() @MaxLength(30) siteId?: string;
  @IsOptional() @IsString() @MaxLength(30) warehouseId?: string;
  @IsOptional() @IsString() @MaxLength(50) materialId?: string;
  @IsOptional() @IsString() typeCode?: string;
  @IsOptional() @IsIn(['D', 'C']) status?: string;
  @IsOptional() @Matches(/^\d{8}$/) from?: string;
  @IsOptional() @Matches(/^\d{8}$/) to?: string;
}
