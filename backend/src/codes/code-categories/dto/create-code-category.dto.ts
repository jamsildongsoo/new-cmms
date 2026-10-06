import { IsString } from 'class-validator';

export class CreateCodeCategoryDto {
  @IsString()
  codeId: string;

  @IsString()
  name: string;

  @IsString()
  module: string;
}
