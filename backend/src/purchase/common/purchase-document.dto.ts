import { IsOptional, IsString, MaxLength } from 'class-validator';
export class PurchaseDocumentFieldsDto {
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(30) siteId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) deptId?: string | null;
  @IsOptional() @IsString() @MaxLength(50) requesterId?: string;
  @IsOptional() @IsString() @MaxLength(50) typeCode?: string | null;
  @IsOptional() @IsString() content?: string | null;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
}
