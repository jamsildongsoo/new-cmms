import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsNotEmpty,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ModuleCode } from '../../../common/constants/modules';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { INVENTORY_TYPES, INVENTORY_KINDS } from '../../inventory.constant';
export class InventoryItemDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() unitPrice?: string;
  @IsOptional() @Matches(/^-?\d{1,20}$/) amount?: string;
  @IsOptional() @IsString() @MaxLength(50) refItemId?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
// frontend/src/modules/inventory/transactions/inventory.api.ts와 함께 수정한다.
export class CreateInventoryDto {
  @IsOptional() @IsString() @MaxLength(50) inventoryDocumentId?: string;
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsIn(INVENTORY_TYPES) type: 'IN' | 'OUT' | 'ADJUST';
  @IsOptional() @IsIn(INVENTORY_KINDS) kind?:
    'GENERAL' | 'PURCHASE' | 'TRANSFER' | null;
  @Matches(/^\d{8}$/) postingDate: string;
  @IsString() @IsNotEmpty() @MaxLength(30) siteId: string;
  @IsString() @IsNotEmpty() @MaxLength(30) warehouseId: string;
  @IsOptional() @IsString() @MaxLength(30) deptId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) toSiteId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) toWarehouseId?: string | null;
  @IsOptional() @IsIn([ModuleCode.PURORD, ModuleCode.INVDOC]) refModule?:
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
export class CancelInventoryDto {
  @IsString() @IsNotEmpty() reason: string;
}
export class InventorySearchDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['id', 'documentNo', 'title', 'createdBy']) searchType?: 'id' | 'documentNo' | 'title' | 'createdBy';
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() @MaxLength(30) siteId?: string;
  @IsOptional() @IsString() @MaxLength(30) warehouseId?: string;
  @IsOptional() @IsString() @MaxLength(50) materialId?: string;
  @IsOptional() @IsIn(INVENTORY_TYPES) type?: string;
  @IsOptional() @IsIn(INVENTORY_KINDS) kind?: string;
  @IsOptional() @IsIn(['W', 'C', 'X']) status?: string;
  @IsOptional() @Matches(/^\d{8}$/) from?: string;
  @IsOptional() @Matches(/^\d{8}$/) to?: string;
}

export class ConfirmInventoryDto {
  @Matches(/^\d{8}$/) postingDate: string;
}
