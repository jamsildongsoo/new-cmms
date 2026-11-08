import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
// 회사·사업장·창고번호는 식별자이므로 수정 입력에서 제외한다.
export class UpdateWarehouseDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
}
