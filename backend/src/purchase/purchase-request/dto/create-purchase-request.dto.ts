import { IsOptional, MaxLength, IsString } from 'class-validator';

import { PurchaseRequestSaveDto } from './purchase-request.dto';
export class CreatePurchaseRequestDto extends PurchaseRequestSaveDto {
  @IsOptional() @IsString() @MaxLength(50) requestId: string;
}
