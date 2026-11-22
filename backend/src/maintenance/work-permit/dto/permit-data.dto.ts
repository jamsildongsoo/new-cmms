// 유형별 입력 항목·제약 변경 시 permit-template.ts, permit-validation.ts, WorkPermitService.approvalDraft 및 프런트 PermitPages.tsx/permitPrint.ts를 함께 수정한다.
import { ModuleCode } from '../../../common/constants/modules';
import type { PermitType } from '../permit-template';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PERMIT_NAMES } from '../permit-template';
// API 계약: frontend/src/modules/maintenance/work-permit/permit.api.ts의 PermitData와 함께 수정한다.
export class PermitDataDto {
  @IsString() @IsNotEmpty() @MaxLength(100) title: string;
  @IsString() @IsNotEmpty() applicationDate: string;
  @IsIn(['INTERNAL', 'EXTERNAL']) applicantType: string;
  @IsString() @IsNotEmpty() @MaxLength(50) applicantName: string;
  @IsString() @IsNotEmpty() @MaxLength(100) organization: string;
  @IsOptional() @IsString() @MaxLength(50) phoneNumber?: string;
  @IsIn(['INTERNAL', 'OUTSOURCED']) workType: string;
  @IsString() @IsNotEmpty() @MaxLength(100) location: string;
  @IsOptional() @IsString() @MaxLength(50) equipmentNo?: string;
  @IsOptional() @IsString() @MaxLength(100) equipmentName?: string;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsString() @IsNotEmpty() @MaxLength(250) summary: string;
}
export class PermitSectionDto {
  @IsIn(Object.keys(PERMIT_NAMES)) type: PermitType;
  @IsInt() templateVersion: number;
  @IsString() @IsNotEmpty() @MaxLength(100) safetyRequirements: string;
  @IsString() @MaxLength(60) specialRequirements: string;
  @IsString() @MaxLength(60) safetyReviewOpinion: string;
}
export class DocumentFileDto {
  @IsString() requirementId: string;
  @IsString() @MaxLength(50) attachmentId: string;
  @IsInt() @Min(1) itemNo: number;
}
export class SaveWorkPermitDto {
  @IsOptional() @IsString() @MaxLength(50) documentNo?: string;
  @IsDefined() @ValidateNested() @Type(() => PermitDataDto) data: PermitDataDto;
  @IsOptional() @IsIn([ModuleCode.PERREQ]) refModule?: string | null;
  @IsOptional() @IsString() @MaxLength(50) refId?: string | null;
  @IsArray()
  @IsIn(Object.keys(PERMIT_NAMES), { each: true })
  permitTypes: PermitType[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermitSectionDto)
  sections: PermitSectionDto[];
  @IsString() @IsNotEmpty() @MaxLength(50) issuerId: string;
  @IsString() @IsNotEmpty() @MaxLength(50) approverId: string;
  @IsOptional() @IsString() @MaxLength(50) attachmentId?: string | null;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentFileDto)
  documentFiles: DocumentFileDto[];
}
