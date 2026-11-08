import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CostItemDto,
  LaborItemDto,
  MaterialItemDto,
} from './work-order-item.dto';
import type { OrderKind } from '../entities/work-order.entity';

export class CreateWorkOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workOrderId: string;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNo?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
  @IsIn(['PLAN', 'ACTUAL'])
  orderKind: OrderKind;
  @IsOptional()
  @IsIn(['work_request', 'work_order'])
  refModule?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refId?: string | null;
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  equipmentId: string;
  @Matches(/^\d{8}$/)
  workDate: string;
  @IsOptional()
  @IsString()
  @MaxLength(50)
  typeCode?: string | null;
  @IsOptional()
  @IsString()
  content?: string | null;
  @IsOptional()
  @IsString()
  note?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LaborItemDto)
  laborItems?: LaborItemDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  materials?: MaterialItemDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CostItemDto)
  costItems?: CostItemDto[];
  @IsOptional()
  @IsString()
  @MaxLength(50)
  attachmentId?: string | null;
}
