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

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNo?: string;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;
  @IsOptional()
  @IsIn(['work_request', 'work_order'])
  refModule?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  refId?: string | null;
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  equipmentId?: string;
  @IsOptional()
  @Matches(/^\d{8}$/)
  workDate?: string;
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
