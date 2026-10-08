import {
  PM_MODULE,
  type PreventiveMaintenance,
} from '../api/preventiveMaintenance.api'
import { buildSnapshot, type ApprovalDraft } from './snapshot'

export function toPreventiveMaintenanceDraft(
  document: PreventiveMaintenance,
): ApprovalDraft {
  return {
    refModule: PM_MODULE,
    refId: document.pmId,
    title: `[Preventive Maintenance] ${document.title}`,
    contentJson: buildSnapshot([
      `Document No: ${document.documentNo}`,
      `Equipment: ${document.equipmentId}`,
      `Planned date: ${document.plannedDate ?? '-'}`,
      `Requester: ${document.requesterId}`,
      '',
      document.content ?? '',
    ]),
  }
}
