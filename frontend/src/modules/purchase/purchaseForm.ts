import { buildFieldTable, type ApprovalDraft } from '@/modules/approvals'
import type { PurchaseKind, PurchaseRecord } from './purchase.api'
export const purchaseLabel = (kind: PurchaseKind) =>
  kind === 'request' ? '구매요청서' : '구매발주서'
export const inputDate = (date: string | null | undefined) =>
  date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : ''
export const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
    new Date(),
  )
export function previewAmount(
  quantity: string,
  unitPrice: string | null | undefined,
) {
  try {
    if (unitPrice == null || unitPrice === '') return ''
    const parse = (value: string, digits: number) => {
      if (!/^\d+(\.\d+)?$/.test(value)) throw Error()
      const [i, f = ''] = value.split('.')
      if (f.length > digits) throw Error()
      return (
        BigInt(i) * 10n ** BigInt(digits) + BigInt(f.padEnd(digits, '0') || '0')
      )
    }
    return (
      (parse(quantity, 6) * parse(unitPrice, 8) + 50000000000000n) /
      100000000000000n
    ).toString()
  } catch {
    return ''
  }
}
export function purchaseDraft(
  kind: PurchaseKind,
  row: PurchaseRecord,
): ApprovalDraft {
  const fields: [string, string | null | undefined][] = [
    ['문서번호', row.requestId ?? row.orderId],
    ['관리번호', row.documentNo],
    ['제목', row.title],
    ['사업장', row.siteId],
    ['부서', row.deptId],
    [
      '요청/발주일',
      inputDate(kind === 'request' ? row.requestDate : row.orderDate),
    ],
    [
      '필요일/납기',
      inputDate(
        kind === 'request' ? row.requiredDate : row.expectedDeliveryDate,
      ),
    ],
    ['담당자', row.requesterId],
    ['공급처', row.supplierName],
    ...(kind === 'order'
      ? [['벤더번호', row.vendorId] as [string, string | null | undefined]]
      : []),
    ...(kind === 'order'
      ? [['금액 합계', row.totalAmount] as [string, string | undefined]]
      : []),
    ['비고', row.note],
  ]
  const paragraph = (text: string) => ({
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  })
  const cell = (text: string, header = false) => ({
    type: header ? 'tableHeader' : 'tableCell',
    content: [paragraph(text)],
  })
  return {
    refModule: kind === 'request' ? 'purchase_request' : 'purchase_order',
    refId: (row.requestId ?? row.orderId)!,
    attachmentId: row.attachmentId,
    title: `[${purchaseLabel(kind)}] ${row.title}`,
    contentJson: {
      type: 'doc',
      content: [
        buildFieldTable(fields),
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                '자재번호',
                '자재명',
                '규격',
                '단위',
                '수량',
                ...(kind === 'order' ? ['단가', '금액'] : []),
              ].map((v) => cell(v, true)),
            },
            ...row.items.map((i) => ({
              type: 'tableRow',
              content: [
                i.materialId,
                i.materialName,
                i.spec ?? '',
                i.baseUnit,
                i.quantity,
                ...(kind === 'order'
                  ? [i.unitPrice ?? '미산정', i.amount ?? '미산정']
                  : []),
              ].map((v) => cell(v)),
            })),
          ],
        },
        ...(row.content ?? '').split('\n').map(paragraph),
      ],
    },
  }
}
