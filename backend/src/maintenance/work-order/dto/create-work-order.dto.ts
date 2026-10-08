import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateWorkOrderDto {
  @IsUUID()
  workOrderId: string;

  @IsString()
  @IsNotEmpty()
  documentNo: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  equipmentId: string;

  @Matches(/^\d{8}$/)
  workDate: string;

  @IsOptional()
  @IsString()
  typeCode?: string | null;

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
