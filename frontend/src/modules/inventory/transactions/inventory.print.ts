import { formatDecimal, type NumericPrecision } from '@/shared/lib/numeric'
import { printDocument } from '@/shared/lib/print'
import { formatDateTime, dateInput } from '@/shared/lib/format'
import {
  inventoryLabel,
  type InventoryVariant,
} from '@/shared/metadata/metadata'

import type { InventoryRecord } from './inventory.api'

// 화면 입력값과 동일한 항목으로 상세 출력폼을 구성한다.
export function printInventory(
  record: InventoryRecord | null,
  variants: readonly InventoryVariant[],
  precision: NumericPrecision,
  statuses: readonly { value: string; label: string }[],
) {
  if (!record) return
  const typeLabel = inventoryLabel(variants, record.type, record.kind)
  const fields: [string, string | null | undefined][] = [
    ['문서번호', record.inventoryDocumentId],
    ['관리번호', record.documentNo],
    ['수불 유형', typeLabel],
    [
      '상태',
      statuses.find((s) => s.value === record.status)?.label ??
        record.status,
    ],
    ['제목', record.title],
    ['전기일', dateInput(record.postingDate)],
    ['처리 사업장', record.siteId],
    ['처리 창고', record.warehouseId],
    ['담당부서', record.deptId],
  ]
  if (record.type === 'OUT' && record.kind === 'TRANSFER')
    fields.push(
      ['도착 사업장', record.toSiteId],
      ['수령 창고', record.toWarehouseId],
    )
  if (record.refId) fields.push(['원본 문서번호', record.refId])
  if (record.type === 'IN' && record.kind === 'TRANSFER')
    fields.push(
      ['출발 사업장', record.sourceSiteId],
      ['출발 창고', record.sourceWarehouseId],
    )
  if (record.status === 'X')
    fields.push(
      ['취소자', record.cancelledBy],
      ['취소시각', formatDateTime(record.cancelledAt)],
      ['취소사유', record.cancelReason],
    )
  fields.push(['사유', record.reason], ['비고', record.note])
  printDocument({
    title: typeLabel,
    fields,
    columns: [
      '자재',
      '명칭',
      '규격',
      '단위',
      '수량',
      '단가',
      '금액',
      '적요',
    ],
    rows: record.items.map((i) => [
      i.materialId,
      i.materialName,
      i.spec,
      i.baseUnit,
      formatDecimal(i.quantity, precision.quantity),
      formatDecimal(i.unitPrice, precision.unitPrice),
      i.amount,
      i.note,
    ]),
  })
}
