import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreatePurchaseOrderDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  documentNo: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  typeCode?: string | null;

  @IsOptional()
  @Matches(/^\d{8}$/)
  expectedDeliveryDate?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  attachmentId?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
