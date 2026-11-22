import type { InventoryRecord } from './inventory.api'
// 메뉴 구성용 값이며 저장되는 type/kind 원본은 backend/src/inventory/inventory.constant.ts이다.
export type InventoryMenu = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUST'
export const inventoryMenus = {
  IN: { path: '/inventory-in', label: '입고', type: 'IN', kind: 'GENERAL' },
  OUT: { path: '/inventory-out', label: '출고', type: 'OUT', kind: 'GENERAL' },
  TRANSFER: {
    path: '/inventory-transfer',
    label: '타창고출고',
    type: 'OUT',
    kind: 'TRANSFER',
  },
  ADJUST: {
    path: '/inventory-adjust',
    label: '조정',
    type: 'ADJUST',
    kind: null,
  },
} as const
export function inventoryMenu(
  record: Pick<InventoryRecord, 'type' | 'kind'>,
): InventoryMenu {
  return record.type === 'IN'
    ? 'IN'
    : record.type === 'ADJUST'
      ? 'ADJUST'
      : record.kind === 'TRANSFER'
        ? 'TRANSFER'
        : 'OUT'
}
