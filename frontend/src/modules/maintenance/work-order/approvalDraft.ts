import { buildFieldTable, type ApprovalDraft } from '@/modules/approvals'
import type { WorkOrder } from './workOrder.api'
import { dateInput, kindName, money } from './workOrderForm'

const paragraph = (value: string) => ({
  type: 'paragraph',
  content: value ? [{ type: 'text', text: value }] : [],
})
function table(headers: string[], rows: string[][]) {
  return {
    type: 'table',
    content: [headers, ...rows].map((row, index) => ({
      type: 'tableRow',
      content: row.map((value) => ({
        type: index === 0 ? 'tableHeader' : 'tableCell',
        content: [paragraph(value)],
      })),
    })),
  }
}
/** 저장된 최신 원본을 복사한다. 결재 본문 편집은 원본 JSON 배열을 변경하지 않는다. */
export function toWorkOrderDraft(
  document: WorkOrder,
  labels: { equipment?: string; plan?: string } = {},
): ApprovalDraft {
  const content: unknown[] = [
    buildFieldTable([
      ['구분', kindName(document.orderKind)],
      ['문서번호', document.workOrderId],
      ['관리번호', document.documentNo],
      ['작업명', document.title],
      [
        '대상 설비',
        labels.equipment
          ? `${document.equipmentId} / ${labels.equipment}`
          : document.equipmentId,
      ],
      ['작업일', dateInput(document.workDate)],
      [
        document.orderKind === 'PLAN' ? '참조 의뢰서' : '참조 계획',
        labels.plan || document.refId,
      ],
      ['작업유형', document.typeCode],
      ['작성자', document.requesterId],
      ['사업장', document.siteId],
      ['부서', document.deptId],
    ]),
    paragraph('작업 내용'),
    ...(document.content || '').split('\n').map(paragraph),
  ]
  const sections = [
    [
      '투입 인력·공수',
      ['작업자', '작업 내용', '시간'],
      document.laborItems.map((r) => [
        r.workerName,
        r.content,
        String(r.hours),
      ]),
    ],
    [
      '사용 자재',
      ['자재명', '규격', '수량', '단위', '단가', '금액'],
      document.materials.map((r) => [
        r.name,
        r.spec,
        String(r.quantity),
        r.unit,
        money(r.unitPrice),
        money(r.amount),
      ]),
    ],
    [
      '기타 비용',
      ['비용 항목', '금액', '비고'],
      document.costItems.map((r) => [r.name, money(r.amount), r.note]),
    ],
  ] as const
  for (const [title, headers, rows] of sections) {
    content.push(
      paragraph(title),
      rows.length
        ? table([...headers], rows)
        : paragraph('등록된 내역이 없습니다.'),
    )
  }
  content.push(
    paragraph(`총 공수: ${document.totalHours}시간`),
    paragraph(
      `자재비: ${money(document.materialTotal)}원 / 기타 비용: ${money(document.costTotal)}원`,
    ),
    paragraph(`총 비용: ${money(document.totalCost)}원 (원화, 부가세 제외)`),
    paragraph('비고'),
    ...(document.note || '').split('\n').map(paragraph),
  )
  return {
    attachmentId: document.attachmentId,
    refModule: 'work_order',
    refId: document.workOrderId,
    title: `[작업 오더 ${kindName(document.orderKind)}] ${document.title}`,
    contentJson: { type: 'doc', content },
  }
}
