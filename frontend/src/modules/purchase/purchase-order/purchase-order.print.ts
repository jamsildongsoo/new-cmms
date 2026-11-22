import { formatDecimal, type NumericPrecision } from '@/shared/lib/numeric'
import { printDocument } from '@/shared/lib/print'
import {
  purchaseOrderLabel,
  type PurchaseOrderRecord,
  type PurchaseOrderItem,
} from './purchase-order.api'
import { previewAmount } from './purchase-order.calculation'

// 화면 입력값과 동일한 항목으로 상세 출력폼을 구성한다.
export function printPurchaseOrder({
  precision,
  record,
  form,
  items,
  refId,
  vendorName,
  total,
}: {
  precision: NumericPrecision
  record: PurchaseOrderRecord | null
  form: Record<
    | 'documentNo'
    | 'title'
    | 'date'
    | 'dueDate'
    | 'requesterId'
    | 'note'
    | 'content'
    | 'toSiteId'
    | 'vendorId'
    | 'deliveryLocation',
    string
  >
  items: PurchaseOrderItem[]
  refId: string
  vendorName: string
  total: string
}) {
  return printDocument({
    title: purchaseOrderLabel,
    fields: [
      ['문서번호', record?.orderId],
      ['관리번호', form.documentNo],
      ['제목', form.title],
      ['참조 구매요청', refId],
      ['입고 예정 사업장', form.toSiteId],
      ['일자', form.date],
      ['필요일/납기', form.dueDate],
      ['담당자', form.requesterId],
      ['공급처', vendorName],
      ['거래처번호', form.vendorId] as [string, string],
      ['납품 장소', form.deliveryLocation],
      ['합계', total] as [string, string],
      ['비고', form.note],
    ],
    columns: ['자재번호', '명칭', '규격', '단위', '수량', '단가', '금액'],
    rows: items.map((i) => [
      i.materialId,
      i.materialName,
      i.spec,
      i.baseUnit,
      formatDecimal(i.quantity, precision.quantity),
      i.unitPrice == null
        ? '미산정'
        : formatDecimal(i.unitPrice, precision.unitPrice),
      previewAmount(i.quantity, i.unitPrice) || '미산정',
    ]),
    text: form.content,
  })
}
