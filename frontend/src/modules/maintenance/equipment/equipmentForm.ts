import { dateInput, dateValue, todayDateInput } from '@/shared/lib/format'
import type { Equipment, EquipmentPayload } from './equipment.api'

export const equipmentFields = [
  ['equipmentId', '설비번호'],
  ['name', '설비명'],
  ['siteId', '사업장'],
  ['deptId', '담당 부서'],
  ['typeCode', '설비 유형'],
  ['location', '설치위치'],
  ['maker', '제조사'],
  ['model', '모델'],
  ['spec', '사양'],
  ['serialNo', '일련번호'],
  ['installDate', '설치일'],
  ['inspectionPeriod', '점검 주기'],
  ['inspectionUnit', '점검 주기 단위'],
  ['inspectionDate', '점검일'],
  ['nextInspectionDate', '다음 점검일'],
  ['legalInspectionPeriod', '법정점검 주기'],
  ['legalInspectionUnit', '법정점검 주기 단위'],
  ['note', '비고'],
  ['parentEquipmentId', '상위 설비'],
  ['pmTargetYn', '예방점검 대상'],
  ['permitTargetYn', '작업허가 대상'],
  ['legalInspectionDate', '법정점검일'],
  ['legalNextInspectionDate', '다음 법정점검일'],
] as const

export type EquipmentForm = Record<
  (typeof equipmentFields)[number][0],
  string
> & { attachmentId: string | null }

export const emptyEquipmentForm = Object.fromEntries([
  ...equipmentFields.map(([key]) => [key, key.endsWith('Yn') ? 'N' : '']),
  ['attachmentId', null],
]) as EquipmentForm

export const inspectionUnits = [
  { value: 'DAY', label: '일' },
  { value: 'WEEK', label: '주' },
  { value: 'MONTH', label: '월' },
  { value: 'YEAR', label: '년' },
]

export function equipmentToForm(row: Equipment): EquipmentForm {
  const form = { ...emptyEquipmentForm, attachmentId: row.attachmentId }
  for (const [key] of equipmentFields) {
    const value = row[key]
    form[key] = key.endsWith('Date')
      ? dateInput(value as string | null)
      : String(value ?? (key.endsWith('Yn') ? 'N' : ''))
  }
  return form
}

export function equipmentPayload(form: EquipmentForm): EquipmentPayload {
  const { equipmentId: _id, ...rest } = form
  void _id
  return {
    ...rest,
    parentEquipmentId: form.parentEquipmentId || null,
    legalInspectionDate: dateValue(form.legalInspectionDate) || null,
    legalNextInspectionDate:
      dateValue(form.legalNextInspectionDate) || null,
    installDate: dateValue(form.installDate) || null,
    inspectionDate: dateValue(form.inspectionDate) || null,
    nextInspectionDate:
      Number(form.inspectionPeriod) > 0 && form.inspectionUnit
        ? dateValue(form.nextInspectionDate) || null
        : null,
    inspectionPeriod:
      form.inspectionPeriod === '' ? null : Number(form.inspectionPeriod),
    inspectionUnit: form.inspectionUnit || null,
    legalInspectionPeriod:
      form.legalInspectionPeriod === ''
        ? null
        : Number(form.legalInspectionPeriod),
    legalInspectionUnit: form.legalInspectionUnit || null,
  }
}

// 날짜 전용 값은 서울의 오늘과 비교한다. 당일과 미입력은 지연으로 표시하지 않는다.
export function isInspectionOverdue(
  value: string | null,
  now = new Date(),
) {
  const today = dateValue(todayDateInput(now))
  return Boolean(value && value < today)
}

export const equipmentFieldGroups: { label: string; keys: string[] }[] = [
  {
    label: '일반정보',
    keys: [
      'equipmentId',
      'name',
      'siteId',
      'deptId',
      'typeCode',
      'location',
      'parentEquipmentId',
    ],
  },
  { label: '제조사정보', keys: ['maker', 'model', 'spec', 'serialNo'] },
  {
    label: '운영정보',
    keys: [
      'installDate',
      'pmTargetYn',
      'permitTargetYn',
      'inspectionPeriod',
      'inspectionUnit',
      'inspectionDate',
      'nextInspectionDate',
    ],
  },
  {
    label: '법정점검',
    keys: [
      'legalInspectionPeriod',
      'legalInspectionUnit',
      'legalInspectionDate',
      'legalNextInspectionDate',
    ],
  },
  { label: '기타정보', keys: ['note'] },
]
