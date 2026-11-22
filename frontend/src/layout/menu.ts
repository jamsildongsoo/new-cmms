// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
/** 홈·사이드바가 공유하는 메뉴 순서와 표시 권한이다. 실제 접근 권한은 서버에서 검사한다. */
import {
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Home,
  MessageSquare,
  MapPin,
  Package,
  Shield,
  UserRound,
  UsersRound,
  Warehouse,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
export interface MenuItem {
  label: string
  path: string
  permission?: string
  icon: LucideIcon
}
export interface MenuGroup {
  label: string
  items: MenuItem[]
}
// 메뉴와 홈의 진입 링크는 같은 권한 기준을 사용한다. 최종 접근 검사는 서버에서 한다.
export const menuGroups: MenuGroup[] = [
  { label: '홈', items: [{ label: '홈', path: '/', icon: Home }] },
  {
    label: '전자결재',
    items: [{ label: '결재문서', path: '/approvals', icon: ClipboardCheck }],
  },
  {
    label: '게시판',
    items: [{ label: '게시판', path: '/boards', icon: MessageSquare }],
  },
  {
    label: '보전관리',
    items: [
      {
        label: '설비 마스터',
        path: '/equipment',
        permission: 'EQUIP:read',
        icon: Wrench,
      },
      {
        label: '예방점검',
        path: '/preventive-maintenance',
        permission: 'PMAINT:read',
        icon: CalendarCheck,
      },
      {
        label: '작업의뢰서',
        path: '/work-request',
        permission: 'WRKREQ:read',
        icon: Wrench,
      },
      {
        label: '작업 오더',
        path: '/work-order',
        permission: 'WRKORD:read',
        icon: Wrench,
      },
      {
        label: '허가요청서',
        path: '/work-permit-request',
        permission: 'PERREQ:read',
        icon: ClipboardCheck,
      },
      {
        label: '작업허가서',
        path: '/work-permit',
        permission: 'PERMIT:read',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: '구매관리',
    items: [
      {
        label: '거래처 관리',
        path: '/vendor',
        permission: 'VENDOR:read',
        icon: Building2,
      },
      {
        label: '구매요청서',
        path: '/purchase-request',
        permission: 'PURREQ:read',
        icon: Package,
      },
      {
        label: '구매발주서',
        path: '/purchase-order',
        permission: 'PURORD:read',
        icon: Package,
      },
    ],
  },
  {
    label: '재고관리',
    items: [
      {
        label: '자재 마스터',
        path: '/material',
        permission: 'MATL:read',
        icon: Package,
      },
      {
        label: '창고 관리',
        path: '/warehouses',
        permission: 'WHSE:read',
        icon: Warehouse,
      },
      {
        label: '입고',
        path: '/inventory-in',
        permission: 'INVDOC:read',
        icon: Warehouse,
      },
      {
        label: '출고',
        path: '/inventory-out',
        permission: 'INVDOC:read',
        icon: Warehouse,
      },
      {
        label: '타창고출고',
        path: '/inventory-transfer',
        permission: 'INVDOC:read',
        icon: Warehouse,
      },
      {
        label: '조정',
        path: '/inventory-adjust',
        permission: 'INVDOC:read',
        icon: Warehouse,
      },
      {
        label: '재고 현황',
        path: '/stock-status',
        permission: 'STOCK:read',
        icon: Warehouse,
      },
      {
        label: '수불장',
        path: '/stock-ledger',
        permission: 'LEDGER:read',
        icon: Warehouse,
      },
      {
        label: '월 마감',
        path: '/monthly-closing',
        permission: 'MCLOSE:read',
        icon: CalendarCheck,
      },
    ],
  },
  {
    label: '조직관리',
    items: [
      {
        label: '회사 정보',
        path: '/companies',
        permission: 'COMP:read',
        icon: Building2,
      },
      {
        label: '사업장 관리',
        path: '/sites',
        permission: 'SITE:read',
        icon: MapPin,
      },
      {
        label: '부서 관리',
        path: '/departments',
        permission: 'DEPT:read',
        icon: UsersRound,
      },
    ],
  },
  {
    label: '사용자·권한관리',
    items: [
      {
        label: '사용자 관리',
        path: '/users',
        permission: 'USER:read',
        icon: UserRound,
      },
      {
        label: '로그인 이력',
        path: '/login-history',
        permission: 'LOGHIST:read',
        icon: Shield,
      },
      {
        label: '역할 관리',
        path: '/roles',
        permission: 'ROLE:read',
        icon: Shield,
      },
    ],
  },
  {
    label: '공통코드',
    items: [
      {
        label: '공통코드 관리',
        path: '/code-items',
        permission: 'CODE:read',
        icon: Package,
      },
    ],
  },
]
