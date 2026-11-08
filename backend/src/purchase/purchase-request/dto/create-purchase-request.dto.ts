import { IsOptional } from 'class-validator';
import { MaxLength } from 'class-validator';
import { IsString } from 'class-validator';
import { PurchaseRequestSaveDto } from '../../common/purchase.dto';
export class CreatePurchaseRequestDto extends PurchaseRequestSaveDto {
  @IsOptional() @IsString() @MaxLength(50) requestId: string;
}
