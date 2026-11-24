import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
export class VendorFieldsDto {
  @IsOptional() @IsString() @MaxLength(50) registrationNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(100) representativeName?: string | null;
  @IsOptional() @IsString() @MaxLength(100) contactName?: string | null;
  @IsOptional() @IsString() @MaxLength(100) phoneNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(200) email?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() note?: string | null;
}
export class CreateVendorDto extends VendorFieldsDto {
  @IsString() @IsNotEmpty() @MaxLength(150) name: string;
  @IsString() @IsNotEmpty() @MaxLength(50) vendorId: string;
}
export class UpdateVendorDto extends VendorFieldsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150) name?: string;
}
export class SearchVendorDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['vendorId', 'name', 'registrationNumber']) searchType?: 'vendorId' | 'name' | 'registrationNumber';
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
