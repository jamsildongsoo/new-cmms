import type { OrderKind, WorkOrder, WorkOrderPayload } from './workOrder.api'

export const kindName = (kind: OrderKind) => (kind === 'PLAN' ? '계획' : '실적')
export const money = (value: number) => value.toLocaleString('ko-KR')
export const dateInput = (value: string) =>
  value ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : ''
export interface LaborRow {
  workerName: string
  content: string
  hours: string
}
export interface MaterialRow {
  name: string
  spec: string
  quantity: string
  unit: string
  unitPrice: string
}
export interface CostRow {
  name: string
  amount: string
  note: string
}
export interface WorkOrderForm {
  attachmentId: string | null
  orderKind: OrderKind
  refModule: string
  refId: string
  documentNo: string
  title: string
  equipmentId: string
  workDate: string
  typeCode: string
  content: string
  note: string
  laborItems: LaborRow[]
  materials: MaterialRow[]
  costItems: CostRow[]
}
export const emptyForm: WorkOrderForm = {
  attachmentId: null,
  orderKind: 'PLAN',
  refModule: '',
  refId: '',
  documentNo: '',
  title: '',
  equipmentId: '',
  workDate: '',
  typeCode: '',
  content: '',
  note: '',
  laborItems: [],
  materials: [],
  costItems: [],
}
export function toForm(row: WorkOrder): WorkOrderForm {
  return {
    attachmentId: row.attachmentId ?? null,
    orderKind: row.orderKind,
    refModule: row.refModule ?? '',
    refId: row.refId ?? '',
    documentNo: row.documentNo,
    title: row.title,
    equipmentId: row.equipmentId,
    workDate: dateInput(row.workDate),
    typeCode: row.typeCode ?? '',
    content: row.content ?? '',
    note: row.note ?? '',
    laborItems: (row.laborItems ?? []).map((item) => ({
      ...item,
      hours: String(item.hours),
    })),
    materials: (row.materials ?? []).map(
      ({ name, spec, quantity, unit, unitPrice }) => ({
        name,
        spec,
        unit,
        quantity: String(quantity),
        unitPrice: String(unitPrice),
      }),
    ),
    costItems: (row.costItems ?? []).map((item) => ({
      ...item,
      amount: String(item.amount),
    })),
  }
}
export function toPayload(form: WorkOrderForm): WorkOrderPayload {
  return {
    attachmentId: form.attachmentId,
    documentNo: form.documentNo,
    title: form.title,
    refModule: form.refModule || null,
    refId: form.refId || null,
    equipmentId: form.equipmentId,
    workDate: form.workDate.replaceAll('-', ''),
    typeCode: form.typeCode || null,
    content: form.content || null,
    note: form.note || null,
    laborItems: form.laborItems.map((r) => ({ ...r, hours: Number(r.hours) })),
    materials: form.materials.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
    })),
    costItems: form.costItems.map((r) => ({ ...r, amount: Number(r.amount) })),
  }
}
/** 수량·단가를 정수로 환산하여 서버와 같은 원 단위 반올림으로 표시한다. */
export function amount(quantity: string, price: string) {
  const q = Number(quantity),
    p = Number(price)
  if (
    !Number.isFinite(q) ||
    !Number.isFinite(p) ||
    q < 0 ||
    p < 0 ||
    q > Number.MAX_SAFE_INTEGER ||
    p > Number.MAX_SAFE_INTEGER
  )
    return 0
  return Number(
    (BigInt(q.toFixed(4).replace('.', '')) *
      BigInt(p.toFixed(2).replace('.', '')) +
      500000n) /
      1000000n,
  )
}
export function totals(form: WorkOrderForm) {
  const totalHours =
    Math.round(
      form.laborItems.reduce((sum, r) => sum + (Number(r.hours) || 0), 0) *
        10000,
    ) / 10000
  const materialTotal = form.materials.reduce(
    (sum, r) => sum + amount(r.quantity, r.unitPrice),
    0,
  )
  const costTotal = form.costItems.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0,
  )
  return {
    totalHours,
    materialTotal,
    costTotal,
    totalCost: materialTotal + costTotal,
  }
}
