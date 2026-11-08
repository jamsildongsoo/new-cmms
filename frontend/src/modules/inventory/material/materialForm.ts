import type { Material, MaterialPayload } from './material.api'
export const materialFields = [
  ['materialId', '자재번호'],
  ['name', '자재명'],
  ['typeCode', '자재 유형'],
  ['baseUnit', '기본 단위'],
  ['spec', '규격'],
  ['maker', '제조사'],
  ['model', '모델'],
  ['note', '비고'],
] as const
export type MaterialForm = Record<
  (typeof materialFields)[number][0],
  string
> & { attachmentId: string | null }
export const emptyMaterialForm: MaterialForm = {
  materialId: '',
  name: '',
  typeCode: '',
  baseUnit: '',
  spec: '',
  maker: '',
  model: '',
  note: '',
  attachmentId: null,
}
export function materialToForm(row: Material): MaterialForm {
  return {
    materialId: row.materialId,
    name: row.name,
    typeCode: row.typeCode,
    baseUnit: row.baseUnit,
    spec: row.spec ?? '',
    maker: row.maker ?? '',
    model: row.model ?? '',
    note: row.note ?? '',
    attachmentId: row.attachmentId,
  }
}
export function materialPayload(form: MaterialForm): MaterialPayload {
  return {
    name: form.name.trim(),
    typeCode: form.typeCode,
    baseUnit: form.baseUnit.trim(),
    spec: form.spec || null,
    maker: form.maker || null,
    model: form.model || null,
    note: form.note || null,
    attachmentId: form.attachmentId,
  }
}
