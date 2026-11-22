// 결재 코드 원본: backend/src/approvals/approval.constant.ts.
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { moduleDocumentPath } from '@/shared/constants/modules'

import { formatDateTime } from '@/shared/lib/format'
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

/** 유형을 바꾸면 대상 구역의 마지막으로 이동하고 나머지 행의 순서는 유지한다. */
export function changeStepType(
  form: Pick<ApprovalFormState, 'line' | 'references'>,
  userId: string,
  type: ApprovalFormStep['type'],
): Pick<ApprovalFormState, 'line' | 'references'> {
  const step = [...form.line, ...form.references].find(
    (item) => item.userId === userId,
  )
  if (!step || step.type === type) return form
  if (step.type !== 'REFERENCE' && type !== 'REFERENCE') {
    return {
      ...form,
      line: form.line.map((item) =>
        item.userId === userId ? { ...item, type } : item,
      ),
    }
  }
  const line = form.line.filter((item) => item.userId !== userId)
  const references = form.references.filter((item) => item.userId !== userId)
  if (type === 'REFERENCE') references.push({ ...step, type })
  else line.push({ ...step, type })
  return { line, references }
}

export function formatDate(value: string | null) {
  return formatDateTime(value)
}

export function stepStatus(step: ApprovalStep) {
  // 참조자의 Y는 승인 행위가 아니므로 처리 결과와 관계없이 참조로 표시한다.
  if (step.type === 'REFERENCE') {
    return '참조'
  }
  if (step.type === 'SUBMITTER' && step.status === 'Y') {
    return '상신 완료'
  }
  if (step.status === 'Y') {
    return step.type === 'AGREE' ? '동의' : '승인'
  }
  if (step.status === 'N') {
    return step.type === 'AGREE' ? '부동의' : '반려'
  }
  return '대기'
}

// 모듈 코드와 URL은 별개다. modules.ts의 명시적인 경로표를 사용한다.
export function sourcePathOf(approval: Approval) {
  return approval.refModule && approval.refId
    ? moduleDocumentPath(approval.refModule, approval.refId)
    : null
}
