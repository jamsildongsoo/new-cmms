/** 홈·사이드바가 공유하는 메뉴 순서와 표시 권한이다. 실제 접근 권한은 서버에서 검사한다. */
import {
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Home,
  MessageSquare,
  KeyRound,
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
        permission: 'equipment:read',
        icon: Wrench,
      },
      {
        label: '예방점검',
        path: '/preventive-maintenance',
        permission: 'preventive_maintenance:read',
        icon: CalendarCheck,
      },
      {
        label: '작업의뢰서',
        path: '/work-request',
        permission: 'work_request:read',
        icon: Wrench,
      },
      {
        label: '작업 오더',
        path: '/work-order',
        permission: 'work_order:read',
        icon: Wrench,
      },
      {
        label: '허가요청서',
        path: '/work-permit-request',
        permission: 'work_permit_request:read',
        icon: ClipboardCheck,
      },
      {
        label: '작업허가서',
        path: '/work-permit',
        permission: 'work_permit:read',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: '구매·재고관리',
    items: [
      {
        label: '자재 마스터',
        path: '/material',
        permission: 'material:read',
        icon: Package,
      },
      {
        label: '벤더 관리',
        path: '/vendor',
        permission: 'vendor:read',
        icon: Building2,
      },
      {
        label: '창고 관리',
        path: '/warehouses',
        permission: 'warehouse:read',
        icon: Warehouse,
      },
      {
        label: '구매요청서',
        path: '/purchase-request',
        permission: 'purchase_request:read',
        icon: Package,
      },
      {
        label: '구매발주서',
        path: '/purchase-order',
        permission: 'purchase_order:read',
        icon: Package,
      },
      {
        label: '재고처리',
        path: '/inventory-document',
        permission: 'inventory_document:read',
        icon: Warehouse,
      },
      {
        label: '재고 현황',
        path: '/stock-status',
        permission: 'stock_status:read',
        icon: Warehouse,
      },
      {
        label: '수불장',
        path: '/stock-ledger',
        permission: 'stock_ledger:read',
        icon: Warehouse,
      },
      {
        label: '월 마감',
        path: '/monthly-closing',
        permission: 'monthly_closing:read',
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
        permission: 'company:read',
        icon: Building2,
      },
      {
        label: '사업장 관리',
        path: '/sites',
        permission: 'site:read',
        icon: MapPin,
      },
      {
        label: '부서 관리',
        path: '/departments',
        permission: 'department:read',
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
        permission: 'user:read',
        icon: UserRound,
      },
      {
        label: '역할 관리',
        path: '/roles',
        permission: 'role:read',
        icon: Shield,
      },
      {
        label: '권한 관리',
        path: '/permissions',
        permission: 'permission:read',
        icon: KeyRound,
      },
    ],
  },
  {
    label: '공통코드',
    items: [
      {
        label: '공통코드 관리',
        path: '/code-items',
        permission: 'code:read',
        icon: Package,
      },
    ],
  },
]
export function visibleMenuGroups(
  hasPermission: (permission: string) => boolean,
) {
  return menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0)
}
