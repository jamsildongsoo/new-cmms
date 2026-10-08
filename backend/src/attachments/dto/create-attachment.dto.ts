import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAttachmentDto {
  @IsString()
  @IsNotEmpty()
  refModule: string;

  @IsUUID()
  refId: string;
}
