import { IsOptional, IsIn, IsString, Matches } from 'class-validator';
export class PurchaseSearchDto {
  @IsOptional() @IsIn(['D', 'P', 'C', 'R', 'X']) status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Matches(/^\d{8}$/) from?: string;
  @IsOptional() @Matches(/^\d{8}$/) to?: string;
}
