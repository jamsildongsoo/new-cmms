// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { buildSnapshot, type ApprovalDraft } from '@/modules/approvals'
import type { WorkRequest } from './workRequest.api'
export function toWorkRequestDraft(row: WorkRequest): ApprovalDraft {
  return {
    refModule: 'WRKREQ',
    refId: row.workRequestId,
    attachmentId: row.attachmentId,
    title: `[작업의뢰] ${row.title}`,
    contentJson: buildSnapshot({
      fields: [
        ['문서번호', row.workRequestId],
        ['관리번호', row.documentNo],
        ['의뢰명', row.title],
        ['설비', row.equipmentId],
        ['발생일', row.occurredDate],
        ['긴급도', row.priorityCode],
        ['의뢰자', row.requesterId],
        ['사업장', row.siteId],
        ['부서', row.deptId],
        ['비고', row.note],
      ],
      content: row.content,
    }),
  }
}
