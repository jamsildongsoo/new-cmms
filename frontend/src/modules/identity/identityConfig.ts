// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import type { Resource } from './identity.api'

export interface IdentityField {
  key: string
  label: string
  required?: boolean
  type?: 'password' | 'email'
}
export const configs: Record<
  Resource,
  { title: string; permission: string; idKey: string; fields: IdentityField[] }
> = {
  users: {
    title: '사용자 관리',
    permission: 'USER',
    idKey: 'userId',
    fields: [
      { key: 'userId', label: '사용자 ID', required: true },
      { key: 'name', label: '이름', required: true },
      {
        key: 'password',
        label: '비밀번호 (미입력 시 현재 비밀번호 유지)',
        type: 'password',
      },
      { key: 'siteId', label: '사업장', required: true },
      { key: 'deptId', label: '부서', required: true },
      { key: 'roleId', label: '역할', required: true },
      { key: 'accessScope', label: '조회 범위', required: true },
      { key: 'email', label: '이메일', type: 'email' },
      { key: 'phoneNumber', label: '전화번호' },
      { key: 'title', label: '직책' },
      { key: 'position', label: '직위' },
    ],
  },
  roles: {
    title: '역할 관리',
    permission: 'ROLE',
    idKey: 'roleId',
    fields: [
      { key: 'roleId', label: '역할 ID', required: true },
      { key: 'name', label: '명칭', required: true },
    ],
  },
}
