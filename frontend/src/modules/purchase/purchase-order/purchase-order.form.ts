import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { buildFieldTable, type ApprovalDraft } from '@/modules/approvals'
import type { PurchaseOrderRecord } from './purchase-order.api'
import { purchaseOrderLabel as purchaseLabel } from './purchase-order.api'

export function purchaseOrderDraft(
  row: PurchaseOrderRecord,
): ApprovalDraft {
  const fields: [string, string | null | undefined][] = [
    ['문서번호', row.orderId],
    ['관리번호', row.documentNo],
    ['제목', row.title],
    ['참조 구매요청', row.refId],
    ['사업장', row.siteId],
    ['입고 예정 사업장', row.toSiteId],
    ['부서', row.deptId],
    ['발주일', dateInput(row.orderDate)],
    ['납기', dateInput(row.expectedDeliveryDate)],
    ['담당자', row.requesterId],
    ['공급처', row.vendor?.name],
    ['거래처번호', row.vendorId],
    ['금액 합계', row.totalAmount],
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
    refModule: 'PURORD',
    refId: row.orderId,
    attachmentId: row.attachmentId,
    title: `[${purchaseLabel}] ${row.title}`,
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
                '단가',
                '금액',
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
                i.unitPrice ?? '미산정',
                i.amount ?? '미산정',
              ].map((v) => cell(v)),
            })),
          ],
        },
        ...(row.content ?? '').split('\n').map(paragraph),
      ],
    },
  }
}
