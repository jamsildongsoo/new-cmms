// key는 단수 snake_case로 관리하며 기존 권한/문서 참조 값을 유지한다.
// rbac는 정책 기록과 초기 권한 생성용이다. HTTP 접근 검사는 Controller 선언이 결정한다.
// 지원 동작(create/read/update/delete)은 여기에 중복 정의하지 않는다.
export const MODULES = {
  COMPANY: { key: 'company', name: '회사 정보', rbac: true },
  SITE: { key: 'site', name: '사업장 관리', rbac: true },
  DEPARTMENT: { key: 'department', name: '부서 관리', rbac: true },
  WAREHOUSE: { key: 'warehouse', name: '창고 관리', rbac: true },
  USER: { key: 'user', name: '사용자 관리', rbac: true },
  ROLE: { key: 'role', name: '역할 관리', rbac: true },
  PERMISSION: { key: 'permission', name: '권한 관리', rbac: true },
  CODE: { key: 'code', name: '공통코드 관리', rbac: true },
  BOARD: { key: 'board', name: '게시판', rbac: false, documentPrefix: 'BORD' },
  ATTACHMENT: { key: 'attachment', name: '첨부파일', rbac: false },
  EQUIPMENT: { key: 'equipment', name: '설비 마스터', rbac: true },
  PREVENTIVE_MAINTENANCE: {
    documentPrefix: 'PMAINT',
    key: 'preventive_maintenance',
    name: '예방점검',
    rbac: true,
  },
  WORK_REQUEST: {
    documentPrefix: 'WRKREQ',
    key: 'work_request',
    name: '작업의뢰서',
    rbac: true,
  },
  WORK_ORDER: {
    documentPrefix: 'WRKORD',
    key: 'work_order',
    name: '작업 오더',
    rbac: true,
  },
  WORK_PERMIT_REQUEST: {
    documentPrefix: 'PERREQ',
    key: 'work_permit_request',
    name: '허가요청서',
    rbac: true,
  },
  WORK_PERMIT: {
    documentPrefix: 'PERMIT',
    key: 'work_permit',
    name: '작업허가서',
    rbac: true,
  },
  MATERIAL: { key: 'material', name: '자재 마스터', rbac: true },
  VENDOR: { key: 'vendor', name: '벤더 관리', rbac: true },
  PURCHASE_REQUEST: {
    documentPrefix: 'PURREQ',
    key: 'purchase_request',
    name: '구매요청서',
    rbac: true,
  },
  PURCHASE_ORDER: {
    documentPrefix: 'PURORD',
    key: 'purchase_order',
    name: '구매발주서',
    rbac: true,
  },
  INVENTORY_DOCUMENT: {
    documentPrefix: 'INVDOC',
    key: 'inventory_document',
    name: '재고처리',
    rbac: true,
  },
  STOCK_STATUS: { key: 'stock_status', name: '재고 현황', rbac: true },
  STOCK_LEDGER: { key: 'stock_ledger', name: '수불장', rbac: true },
  MONTHLY_CLOSING: { key: 'monthly_closing', name: '월 마감', rbac: true },
  APPROVAL: {
    documentPrefix: 'APPROV',
    key: 'approval',
    name: '결재문서',
    rbac: false,
  },
} as const satisfies Record<
  string,
  { key: string; name: string; rbac: boolean; documentPrefix?: string }
>;

// 기존 Controller/Service는 같은 키를 계속 사용한다. 별도 키 목록을 수동으로 유지하지 않는다.
export const AppModuleKey = Object.fromEntries(
  Object.entries(MODULES).map(([symbol, module]) => [symbol, module.key]),
) as { readonly [K in keyof typeof MODULES]: (typeof MODULES)[K]['key'] };

export type AppModuleKey = (typeof AppModuleKey)[keyof typeof AppModuleKey];
export const MODULE_LIST = Object.values(MODULES);
export function findModule(key: string) {
  return MODULE_LIST.find((module) => module.key === key);
}
