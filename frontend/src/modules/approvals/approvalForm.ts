import type {
  Approval,
  ApprovalPayload,
  ApprovalStep,
  ApprovalStepPayload,
  ApprovalUserInfo,
} from './approvals.api'

export interface ApprovalFormStep extends ApprovalStepPayload {
  userName: string
  deptId: string
  deptName: string
  title: string
  position: string
}

export const stepFromUser = (
  info: ApprovalUserInfo,
  type: ApprovalStepPayload['type'],
): ApprovalFormStep => ({
  type,
  userId: info.userId,
  userName: info.userName,
  deptId: info.deptId,
  deptName: info.deptName ?? '',
  title: info.title ?? '',
  position: info.position ?? '',
})

export interface ApprovalFormState {
  sourceAttachmentIds?: string[]
  approvalId: string
  documentNo: string
  refModule: string | null
  refId: string | null
  title: string
  contentJson: unknown
  attachmentId: string | null
  line: ApprovalFormStep[]
  references: ApprovalFormStep[]
}

export const emptyContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function newForm(): ApprovalFormState {
  return {
    approvalId: '',
    documentNo: '',
    refModule: null,
    refId: null,
    title: '',
    contentJson: emptyContent,
    attachmentId: null,
    line: [],
    references: [],
  }
}

export function toForm(approval: Approval): ApprovalFormState {
  return {
    approvalId: approval.approvalId,
    documentNo: approval.documentNo ?? '',
    refModule: approval.refModule,
    refId: approval.refId,
    title: approval.title,
    contentJson: approval.contentJson,
    attachmentId: approval.attachmentId,
    sourceAttachmentIds: approval.sourceAttachmentIds,
    line: approval.steps
      .filter((step) => step.type === 'APPROVER' || step.type === 'AGREE')
      .sort((x, y) => x.stepNo - y.stepNo)
      .map(toFormStep),
    references: approval.steps
      .filter((step) => step.type === 'REFERENCE')
      .map(toFormStep),
  }
}

function toFormStep(step: ApprovalStep): ApprovalFormStep {
  return {
    type: step.type as ApprovalStepPayload['type'],
    userId: step.userId,
    userName: step.userName ?? '',
    deptId: step.deptId ?? '',
    deptName: step.deptName ?? '',
    title: step.title ?? '',
    position: step.position ?? '',
  }
}

export function toPayload(form: ApprovalFormState): ApprovalPayload {
  return {
    documentNo: form.documentNo,
    refModule: form.refModule,
    refId: form.refId,
    title: form.title,
    contentJson: form.contentJson,
    attachmentId: form.attachmentId,
    steps: [...form.line, ...form.references].map(({ type, userId }) => ({
      type,
      userId,
    })),
  }
}

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-'
}

export function stepStatus(step: ApprovalStep) {
  // 참조자의 Y는 승인 행위가 아니므로 처리 결과와 관계없이 참조로 표시한다.
  if (step.type === 'REFERENCE') {
    return 'Reference'
  }
  if (step.type === 'SUBMITTER' && step.status === 'Y') {
    return 'Submitted'
  }
  if (step.status === 'Y') {
    return step.type === 'AGREE' ? 'Agreed' : 'Approved'
  }
  if (step.status === 'N') {
    return step.type === 'AGREE' ? 'Disagreed' : 'Rejected'
  }
  return 'Waiting'
}

// Convention: a source module serves its document at /<refModule with dashes>/<refId>.
export function sourcePathOf(approval: Approval) {
  const { refModule, refId } = approval
  if (!refModule || !refId) {
    return null
  }
  if (!/^[a-z0-9_]+$/.test(refModule) || !/^[\w-]+$/.test(refId)) {
    return null
  }
  return `/${refModule.replace(/_/g, '-')}/${refId}`
}
