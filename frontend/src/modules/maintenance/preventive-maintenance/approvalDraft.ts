import { buildFieldTable, type ApprovalDraft } from '@/modules/approvals'
import { dateInput } from '@/modules/maintenance/equipment'
import {
  PM_MODULE,
  type PreventiveMaintenance,
} from './preventiveMaintenance.api'

const paragraph = (value: string) => ({
  type: 'paragraph',
  content: value ? [{ type: 'text', text: value }] : [],
})
const cell = (value: string, header = false) => ({
  type: header ? 'tableHeader' : 'tableCell',
  content: [paragraph(value)],
})

/** 상신 버튼을 누를 때마다 저장된 최신 PM으로 Tiptap 본문을 새로 만든다. */
export function toPreventiveMaintenanceDraft(
  document: PreventiveMaintenance,
): ApprovalDraft {
  const content: unknown[] = [
    buildFieldTable([
      ['문서번호', document.pmId],
      ['관리번호', document.documentNo],
      ['점검명', document.title],
      ['설비', document.equipmentId],
      ['점검일', dateInput(document.inspectionDate)],
      ['다음 점검일', dateInput(document.nextInspectionDate)],
      ['점검 유형', document.typeCode],
      ['판정', document.result],
      ['점검부서', document.inspectionDeptName || document.inspectionDeptId],
      ['점검자', document.inspectorName || document.inspectorId],
      ['작성자', document.requesterId],
      ['비고', document.note],
    ]),
  ]
  if (document.content)
    content.push(
      paragraph('점검 내용'),
      ...document.content.split('\n').map(paragraph),
    )
  content.push(paragraph('점검 상세'))
  if (document.items?.length) {
    content.push({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: ['항목', '기준값', '점검값', '단위'].map((label) =>
            cell(label, true),
          ),
        },
        ...document.items.map((item) => ({
          type: 'tableRow',
          content: [
            item.name,
            item.standardValue,
            item.inspectionValue,
            item.unit,
          ].map((value) => cell(value)),
        })),
      ],
    })
  } else content.push(paragraph('점검 상세가 없습니다.'))
  return {
    attachmentId: document.attachmentId,
    refModule: PM_MODULE,
    refId: document.pmId,
    title: `[예방점검] ${document.title}`,
    contentJson: { type: 'doc', content },
  }
}
