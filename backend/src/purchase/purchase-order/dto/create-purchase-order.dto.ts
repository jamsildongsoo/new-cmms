import { IsOptional, MaxLength, IsString } from 'class-validator';

import { PurchaseOrderSaveDto } from './purchase-order.dto';
export class CreatePurchaseOrderDto extends PurchaseOrderSaveDto {
  @IsOptional() @IsString() @MaxLength(50) orderId: string;
}
