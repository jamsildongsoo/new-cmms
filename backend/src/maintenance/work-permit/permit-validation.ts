import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserContext } from '../../auth/types/user-context.type';
import { PermitDataDto } from './dto/permit-data.dto';
export function validatePermitData(data: PermitDataDto) {
  if (
    !data ||
    !data.title?.trim() ||
    !data.summary?.trim() ||
    !data.applicantName?.trim() ||
    !data.organization?.trim() ||
    !data.location?.trim()
  )
    throw new BadRequestException(
      '작업명·신청인·소속·작업지역·개요는 필수입니다.',
    );
  const validDate = (v: string) => {
    const date = new Date(
      `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00Z`,
    );
    return (
      /^\d{8}$/.test(v) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10).replaceAll('-', '') === v
    );
  };
  if (!validDate(data.applicationDate))
    throw new BadRequestException('신청일이 올바르지 않습니다.');
  for (const value of [data.startTime, data.endTime])
    if (
      !/^\d{8}:([01]\d|2[0-3])$/.test(value ?? '') ||
      !validDate(value.slice(0, 8))
    )
      throw new BadRequestException(
        '허가기간은 YYYYMMDD:HH 형식이어야 합니다.',
      );
  if (data.endTime < data.startTime)
    throw new BadRequestException('종료가 시작보다 빠릅니다.');
}
export function permitOwner(
  user: UserContext,
  row: { createdBy: string; status: string },
) {
  if (row.createdBy !== user.userId || row.status !== 'D')
    throw new ForbiddenException('작성자만 D 상태에서 처리할 수 있습니다.');
}
