// 시스템 코드 그룹 원본. 프런트 그룹 선택지는 /system/metadata로 제공한다.
// 키만 공통 규약이며, UNIT 등 그룹 내부 항목은 회사별 DB에서 관리한다.
export const CODE_GROUPS = {
  EQUIP_TYPE: { name: 'EQUIPMENT_TYPE', label: '설비 유형' },
  PMAINT_TYPE: { name: 'PREVENTIVE_MAINTENANCE_TYPE', label: '예방점검 유형' },
  WRKORD_TYPE: { name: 'WORK_ORDER_TYPE', label: '작업 유형' },
  FAILURE_CAUSE_TYPE: { name: 'FAILURE_CAUSE_TYPE', label: '고장 원인 유형' },
  PERMIT_TYPE: { name: 'WORK_PERMIT_TYPE', label: '작업허가 유형' },
  MATL_TYPE: { name: 'MATERIAL_TYPE', label: '자재 유형' },
  PURREQ_TYPE: { name: 'PURCHASE_REQUEST_TYPE', label: '구매요청 유형' },
  PURORD_TYPE: { name: 'PURCHASE_ORDER_TYPE', label: '구매발주 유형' },
  UNIT: { name: 'UNIT', label: '단위' },
} as const;

export type CodeGroupId = keyof typeof CODE_GROUPS;
export const CodeGroup = Object.fromEntries(
  Object.keys(CODE_GROUPS).map((key) => [key, key]),
) as { readonly [K in CodeGroupId]: K };

export function isCodeGroupId(
  value: string | null | undefined,
): value is CodeGroupId {
  return typeof value === 'string' && Object.hasOwn(CODE_GROUPS, value);
}
