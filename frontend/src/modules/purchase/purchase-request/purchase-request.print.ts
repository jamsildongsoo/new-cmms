import { formatDecimal, type NumericPrecision } from '@/shared/lib/numeric'
import { printDocument } from '@/shared/lib/print'
import {
  purchaseRequestLabel,
  type PurchaseRequestRecord,
  type PurchaseRequestItem,
} from './purchase-request.api'

// 화면 입력값과 동일한 항목으로 상세 출력폼을 구성한다.
export function printPurchaseRequest({
  precision,
  record,
  form,
  items,
}: {
  precision: NumericPrecision
  record: PurchaseRequestRecord | null
  form: Record<
    | 'documentNo'
    | 'title'
    | 'date'
    | 'dueDate'
    | 'requesterId'
    | 'note'
    | 'content',
    string
  >
  items: PurchaseRequestItem[]
}) {
  return printDocument({
    title: purchaseRequestLabel,
    fields: [
      ['문서번호', record?.requestId],
      ['관리번호', form.documentNo],
      ['제목', form.title],
      ['일자', form.date],
      ['필요일/납기', form.dueDate],
      ['담당자', form.requesterId],
      ['비고', form.note],
    ],
    columns: ['자재번호', '명칭', '규격', '단위', '수량'],
    rows: items.map((i) => [
      i.materialId,
      i.materialName,
      i.spec,
      i.baseUnit,
      formatDecimal(i.quantity, precision.quantity),
    ]),
    text: form.content,
  })
}
