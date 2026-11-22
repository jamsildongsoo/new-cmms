// 시스템 모듈 원본. 프런트 표시 목록은 /system/metadata로 제공한다.
// 코드는 권한·원문 참조·첨부·채번에 저장되는 고정 식별자다. URL이나 채번 여부를 뜻하지 않는다.
export const MODULES = {
  COMP: { name: 'COMPANY', label: '회사' },
  SITE: { name: 'SITE', label: '사업장' },
  DEPT: { name: 'DEPARTMENT', label: '부서' },
  WHSE: { name: 'WAREHOUSE', label: '창고' },
  USER: { name: 'USER', label: '사용자' },
  ROLE: { name: 'ROLE', label: '역할' },
  LOGHIST: { name: 'LOGIN_HISTORY', label: '로그인 이력' },
  CODE: { name: 'CODE', label: '공통코드' },
  BORD: { name: 'BOARD', label: '게시판' },
  ATTACH: { name: 'ATTACHMENT', label: '첨부파일' },
  EQUIP: { name: 'EQUIPMENT', label: '설비' },
  PMAINT: { name: 'PREVENTIVE_MAINTENANCE', label: '예방점검' },
  WRKREQ: { name: 'WORK_REQUEST', label: '작업의뢰서' },
  WRKORD: { name: 'WORK_ORDER', label: '작업오더' },
  PERREQ: { name: 'WORK_PERMIT_REQUEST', label: '허가요청서' },
  PERMIT: { name: 'WORK_PERMIT', label: '작업허가서' },
  MATL: { name: 'MATERIAL', label: '자재' },
  VENDOR: { name: 'VENDOR', label: '거래처' },
  PURREQ: { name: 'PURCHASE_REQUEST', label: '구매요청서' },
  PURORD: { name: 'PURCHASE_ORDER', label: '구매발주서' },
  INVDOC: { name: 'INVENTORY_DOCUMENT', label: '재고처리' },
  STOCK: { name: 'STOCK_STATUS', label: '재고 현황' },
  LEDGER: { name: 'STOCK_LEDGER', label: '수불장' },
  MCLOSE: { name: 'MONTHLY_CLOSING', label: '월 마감' },
  APPROV: { name: 'APPROVAL', label: '결재문서' },
} as const;

export type ModuleCode = keyof typeof MODULES;
export const ModuleCode = Object.fromEntries(
  Object.keys(MODULES).map((code) => [code, code]),
) as { readonly [K in ModuleCode]: K };

export const MODULE_LIST = Object.entries(MODULES).map(
  ([code, definition]) => ({
    code: code as ModuleCode,
    ...definition,
  }),
);
export function findModule(code: string) {
  return MODULE_LIST.find((module) => module.code === code);
}
