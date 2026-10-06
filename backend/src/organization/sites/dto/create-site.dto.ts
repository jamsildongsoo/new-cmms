import { IsString } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  siteId: string;

  @IsString()
  name: string;
}
