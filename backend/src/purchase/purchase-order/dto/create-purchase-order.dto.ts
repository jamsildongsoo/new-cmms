import { IsOptional } from 'class-validator';
import { MaxLength } from 'class-validator';
import { IsString } from 'class-validator';
import { PurchaseSaveDto } from '../../common/purchase.dto';
export class CreatePurchaseOrderDto extends PurchaseSaveDto {
  @IsOptional() @IsString() @MaxLength(50) orderId: string;
}
