export const Code = {
  EQUIPMENT_TYPE: 'EQUIPMENT_TYPE',
  PREVENTIVE_MAINTENANCE_TYPE: 'PREVENTIVE_MAINTENANCE_TYPE',
  WORK_ORDER_TYPE: 'WORK_ORDER_TYPE',
  FAILURE_CAUSE_TYPE: 'FAILURE_CAUSE_TYPE',
  WORK_PERMIT_TYPE: 'WORK_PERMIT_TYPE',
  MATERIAL_TYPE: 'MATERIAL_TYPE',
  PURCHASE_REQUEST_TYPE: 'PURCHASE_REQUEST_TYPE',
  PURCHASE_ORDER_TYPE: 'PURCHASE_ORDER_TYPE',
} as const;

export type Code = (typeof Code)[keyof typeof Code];

export const isCode = (value: string): value is Code =>
  (Object.values(Code) as string[]).includes(value);
