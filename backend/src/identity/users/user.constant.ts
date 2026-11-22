/** 조회 범위 저장값과 사용자 표시 목록의 원본. */
export const AccessScope = {
  OWN_DEPARTMENT: 'OWN_DEPARTMENT',
  OWN_SITE: 'OWN_SITE',
  COMPANY_ALL: 'COMPANY_ALL',
} as const;
export type AccessScope = (typeof AccessScope)[keyof typeof AccessScope];
export const ACCESS_SCOPE_OPTIONS = [
  { value: AccessScope.OWN_DEPARTMENT, label: '소속 부서 및 하위 부서' },
  { value: AccessScope.OWN_SITE, label: '소속 사업장' },
  { value: AccessScope.COMPANY_ALL, label: '회사 전체' },
];
