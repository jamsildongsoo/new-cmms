// 시스템 권한 원본. 프런트 사용처의 인라인 권한 코드 변경 시 함께 수정한다.
// 프런트는 메뉴·버튼 표시용이고, 실제 API 권한은 백엔드 Controller/Guard에서 검사한다.
import { MODULES, type ModuleCode } from './modules';
export const PermissionAction = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;
export type PermissionAction =
  (typeof PermissionAction)[keyof typeof PermissionAction];
export type PermissionCode = `${ModuleCode}:${PermissionAction}`;
export const buildPermissionCode = (
  moduleCode: ModuleCode,
  action: PermissionAction,
): PermissionCode => `${moduleCode}:${action}`;

/** 지원하는 권한을 명시한다. Controller 조사 없이 선택 목록과 배정 검증에 사용한다. */
export const MODULE_ACTIONS = {
  COMP: ['read', 'update'],
  SITE: ['create', 'read', 'update', 'delete'],
  DEPT: ['create', 'read', 'update', 'delete'],
  WHSE: ['create', 'read', 'update', 'delete'],
  USER: ['create', 'read', 'update', 'delete'],
  ROLE: ['create', 'read', 'update', 'delete'],
  LOGHIST: ['read'],
  CODE: ['create', 'read', 'update', 'delete'],
  BORD: [],
  ATTACH: [],
  EQUIP: ['create', 'read', 'update', 'delete'],
  PMAINT: ['create', 'read', 'update', 'delete'],
  WRKREQ: ['create', 'read', 'update', 'delete'],
  WRKORD: ['create', 'read', 'update', 'delete'],
  PERREQ: ['create', 'read', 'update', 'delete'],
  PERMIT: ['create', 'read', 'update', 'delete'],
  MATL: ['create', 'read', 'update', 'delete'],
  VENDOR: ['create', 'read', 'update', 'delete'],
  PURREQ: ['create', 'read', 'update', 'delete'],
  PURORD: ['create', 'read', 'update', 'delete'],
  INVDOC: ['create', 'read', 'update'],
  STOCK: ['read'],
  LEDGER: ['read'],
  MCLOSE: ['read', 'update'],
  APPROV: [],
} as const satisfies Record<ModuleCode, readonly PermissionAction[]>;

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  create: '등록',
  read: '조회',
  update: '수정',
  delete: '삭제',
};

export const PERMISSION_OPTIONS = Object.entries(MODULE_ACTIONS).flatMap(
  ([code, actions]) =>
    actions.map((action) => ({
      permissionId: `${code}:${action}`,
      module: code,
      moduleLabel: MODULES[code as ModuleCode].label,
      action,
      name: `${MODULES[code as ModuleCode].label} ${PERMISSION_ACTION_LABELS[action]}`,
    })),
);
const permissionIds = new Set(PERMISSION_OPTIONS.map((p) => p.permissionId));
export const isPermissionCode = (value: string): boolean =>
  permissionIds.has(value);
