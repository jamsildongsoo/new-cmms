// API 계약: frontend/src/modules/inventory/inventory.constant.ts와 함께 수정한다.
export const INVENTORY_TYPES = ['IN', 'OUT', 'ADJUST'] as const;
export const INVENTORY_KINDS = ['GENERAL', 'PURCHASE', 'TRANSFER'] as const;
export const INVENTORY_VARIANTS = [
  { type: 'IN', kind: 'GENERAL', label: '일반입고' },
  { type: 'IN', kind: 'PURCHASE', label: '구매입고' },
  { type: 'IN', kind: 'TRANSFER', label: '이동입고' },
  { type: 'OUT', kind: 'GENERAL', label: '일반출고' },
  { type: 'OUT', kind: 'TRANSFER', label: '타창고출고' },
  { type: 'ADJUST', kind: null, label: '조정' },
] as const;
export function inventoryVariant(type: string, kind?: string | null) {
  return INVENTORY_VARIANTS.find(
    (v) => v.type === type && v.kind === (kind ?? null),
  );
}

export const InventoryStatus = {
  WAITING: 'W',
  CONFIRMED: 'C',
  CANCELLED: 'X',
} as const;
export type InventoryStatus =
  (typeof InventoryStatus)[keyof typeof InventoryStatus];
export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  W: '수령 대기',
  C: '확정',
  X: '취소',
};
