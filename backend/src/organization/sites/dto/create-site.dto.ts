import { IsString, MaxLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @MaxLength(30)
  siteId: string;

  @IsString()
  @MaxLength(100)
  name: string;
}
