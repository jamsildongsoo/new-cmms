export const AppModuleKey = {
  COMPANY: 'company',
  SITE: 'site',
  DEPARTMENT: 'department',
  WAREHOUSE: 'warehouse',
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  CODE: 'code',
  ATTACHMENT: 'attachment',
  EQUIPMENT: 'equipment',
  PREVENTIVE_MAINTENANCE: 'preventive_maintenance',
  WORK_ORDER: 'work_order',
  WORK_PERMIT: 'work_permit',
  MATERIAL: 'material',
  PURCHASE_REQUEST: 'purchase_request',
  PURCHASE_ORDER: 'purchase_order',
  INVENTORY_DOCUMENT: 'inventory_document',
  STOCK_STATUS: 'stock_status',
  STOCK_LEDGER: 'stock_ledger',
  MONTHLY_CLOSING: 'monthly_closing',
  APPROVAL: 'approval',
} as const;

export type AppModuleKey = (typeof AppModuleKey)[keyof typeof AppModuleKey];

export const DocumentModuleCode = {
  PREVENTIVE_MAINTENANCE: 'PM',
  WORK_ORDER: 'WO',
  WORK_PERMIT: 'WP',
  PURCHASE_REQUEST: 'PR',
  PURCHASE_ORDER: 'PO',
  INVENTORY_DOCUMENT: 'INV',
  APPROVAL: 'AP',
} as const;

export type DocumentModuleCode =
  (typeof DocumentModuleCode)[keyof typeof DocumentModuleCode];
