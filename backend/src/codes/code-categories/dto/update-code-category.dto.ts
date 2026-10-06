import { IsOptional, IsString } from 'class-validator';

export class UpdateCodeCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  module?: string;
}
