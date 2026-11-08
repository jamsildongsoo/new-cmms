import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
export class PurchaseRequestItemDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(50) materialId: string;
  @IsString() quantity: string;
  @IsOptional() @IsString() note?: string | null;
}
export class PurchaseItemDto extends PurchaseRequestItemDto {
  @IsOptional() @IsString() unitPrice?: string | null;
}
export class PurchaseSaveDto {
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @Matches(/^\d{8}$/) requestDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) orderDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) requiredDate?: string | null;
  @IsOptional() @Matches(/^\d{8}$/) expectedDeliveryDate?: string | null;
  @IsOptional() @IsString() @MaxLength(30) siteId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) deptId?: string | null;
  @IsOptional() @IsString() @MaxLength(50) requesterId?: string;
  @IsOptional() @IsString() @MaxLength(50) typeCode?: string | null;
  @IsOptional() @IsString() content?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(150) supplierName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) vendorId?: string | null;
  @IsOptional() @IsString() @MaxLength(50) supplierRegistrationNo?:
    string | null;
  @IsOptional() @IsString() @MaxLength(100) supplierContactName?: string | null;
  @IsOptional() @IsString() @MaxLength(100) supplierPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(200) supplierEmail?: string | null;
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
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
// 요청은 수량만 관리한다. 가격 비교 자료는 첨부로 관리한다.
export class PurchaseRequestSaveDto extends PurchaseSaveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  declare items: PurchaseRequestItemDto[];
}
export class PurchaseSearchDto {
  @IsOptional() @IsIn(['D', 'P', 'C', 'R', 'X']) status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Matches(/^\d{8}$/) from?: string;
  @IsOptional() @Matches(/^\d{8}$/) to?: string;
}
