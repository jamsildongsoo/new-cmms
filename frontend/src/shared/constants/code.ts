export const CODES = [
  { codeId: 'EQUIPMENT_TYPE', name: 'Equipment Type' },
  { codeId: 'PREVENTIVE_MAINTENANCE_TYPE', name: 'Preventive Maintenance Type' },
  { codeId: 'WORK_ORDER_TYPE', name: 'Work Order Type' },
  { codeId: 'FAILURE_CAUSE_TYPE', name: 'Failure Cause Type' },
  { codeId: 'WORK_PERMIT_TYPE', name: 'Work Permit Type' },
  { codeId: 'MATERIAL_TYPE', name: 'Material Type' },
  { codeId: 'PURCHASE_REQUEST_TYPE', name: 'Purchase Request Type' },
  { codeId: 'PURCHASE_ORDER_TYPE', name: 'Purchase Order Type' },
] as const

export type CodeId = (typeof CODES)[number]['codeId']

export const isCodeId = (value: string | null | undefined): value is CodeId =>
  CODES.some((code) => code.codeId === value)
