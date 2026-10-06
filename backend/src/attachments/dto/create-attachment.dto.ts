import { IsString } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  refModule: string;

  @IsString()
  refNo: string;
}
