import { buildSnapshot, type ApprovalDraft } from '@/modules/approvals'
import { PM_MODULE, type PreventiveMaintenance } from './preventiveMaintenance.api'

export function toPreventiveMaintenanceDraft(
  document: PreventiveMaintenance,
): ApprovalDraft {
  return {
    refModule: PM_MODULE,
    refId: document.pmId,
    title: `[Preventive Maintenance] ${document.title}`,
    contentJson: buildSnapshot({
      fields: [
        ['Document No', document.documentNo],
        ['Equipment', document.equipmentId],
        ['Planned date', document.plannedDate],
        ['Type', document.typeCode],
        ['Requester', document.requesterId],
      ],
      content: document.content,
    }),
  }
}
