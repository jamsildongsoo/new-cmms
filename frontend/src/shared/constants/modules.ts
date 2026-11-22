// 화면 경로는 프런트 소유. 모듈 원본: backend/src/common/constants/modules.ts (MODULES)
export const MODULE_PATHS: Record<string, string> = {
  COMP: '/companies',
  SITE: '/sites',
  DEPT: '/departments',
  WHSE: '/warehouses',
  USER: '/users',
  ROLE: '/roles',
  LOGHIST: '/login-history',
  CODE: '/code-items',
  BORD: '/boards',
  ATTACH: '/attachments',
  EQUIP: '/equipment',
  PMAINT: '/preventive-maintenance',
  WRKREQ: '/work-request',
  WRKORD: '/work-order',
  PERREQ: '/work-permit-request',
  PERMIT: '/work-permit',
  MATL: '/material',
  VENDOR: '/vendor',
  PURREQ: '/purchase-request',
  PURORD: '/purchase-order',
  INVDOC: '/inventory-document',
  STOCK: '/stock-status',
  LEDGER: '/stock-ledger',
  MCLOSE: '/monthly-closing',
  APPROV: '/approvals',
}

export function moduleDocumentPath(code: string, id: string): string | null {
  return Object.hasOwn(MODULE_PATHS, code)
    ? `${MODULE_PATHS[code]}/${encodeURIComponent(id)}`
    : null
}
