import { buildFieldTable, type ApprovalDraft } from '@/modules/approvals'
import type { PurchaseRequestRecord } from './purchase-request.api'
import { purchaseRequestLabel as purchaseLabel } from './purchase-request.api'
import { inputDate } from '../common/purchase.utils'
export function purchaseRequestDraft(
  row: PurchaseRequestRecord,
): ApprovalDraft {
  const fields: [string, string | null | undefined][] = [
    ['문서번호', row.requestId],
    ['관리번호', row.documentNo],
    ['제목', row.title],
    ['사업장', row.siteId],
    ['부서', row.deptId],
    ['요청/발주일', inputDate(row.requestDate)],
    ['필요일/납기', inputDate(row.requiredDate)],
    ['담당자', row.requesterId],
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
    refModule: 'purchase_request',
    refId: row.requestId!,
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
              content: ['자재번호', '자재명', '규격', '단위', '수량'].map((v) =>
                cell(v, true),
              ),
            },
            ...row.items.map((i) => ({
              type: 'tableRow',
              content: [
                i.materialId,
                i.materialName,
                i.spec ?? '',
                i.baseUnit,
                i.quantity,
              ].map((v) => cell(v)),
            })),
          ],
        },
        ...(row.content ?? '').split('\n').map(paragraph),
      ],
    },
  }
}
