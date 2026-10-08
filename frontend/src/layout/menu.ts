import {
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Home,
  KeyRound,
  MapPin,
  Package,
  Shield,
  Tags,
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

export const menuGroups: MenuGroup[] = [
  {
    label: 'Main',
    items: [{ label: 'Home', path: '/', icon: Home }],
  },
  {
    label: 'Organization',
    items: [
      {
        label: 'Companies',
        path: '/companies',
        permission: 'company:read',
        icon: Building2,
      },
      { label: 'Sites', path: '/sites', permission: 'site:read', icon: MapPin },
      {
        label: 'Departments',
        path: '/departments',
        permission: 'department:read',
        icon: UsersRound,
      },
      {
        label: 'Warehouses',
        path: '/warehouses',
        permission: 'warehouse:read',
        icon: Warehouse,
      },
    ],
  },
  {
    label: 'Identity',
    items: [
      { label: 'Users', path: '/users', permission: 'user:read', icon: UserRound },
      { label: 'Roles', path: '/roles', permission: 'role:read', icon: Shield },
      {
        label: 'Permissions',
        path: '/permissions',
        permission: 'permission:read',
        icon: KeyRound,
      },
    ],
  },
  {
    label: 'Codes',
    items: [
      {
        label: 'Code Categories',
        path: '/code-categories',
        permission: 'code:read',
        icon: Tags,
      },
      {
        label: 'Code Items',
        path: '/code-items',
        permission: 'code:read',
        icon: Package,
      },
    ],
  },
  {
    label: 'Maintenance',
    items: [
      {
        label: 'Equipment',
        path: '/equipment',
        permission: 'equipment:read',
        icon: Wrench,
      },
      {
        label: 'Preventive Maintenance',
        path: '/preventive-maintenance',
        permission: 'preventive_maintenance:read',
        icon: CalendarCheck,
      },
    ],
  },
  {
    label: 'Workflow',
    items: [
      {
        label: 'Approvals',
        path: '/approvals',
        permission: 'approval:read',
        icon: ClipboardCheck,
      },
    ],
  },
]
