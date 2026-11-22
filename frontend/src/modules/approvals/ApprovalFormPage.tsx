// 결재 코드 원본: backend/src/approvals/approval.constant.ts.
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useMetadata } from '@/shared/metadata/metadata'
import { useStatusLabels } from '@/shared/metadata/metadata'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AttachmentManager } from '@/modules/attachments'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import type { FormMode } from '@/shared/types/form'
import { printDocument } from '@/shared/lib/print'

import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { RichTextEditor } from '@/shared/ui/RichTextEditor'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/Textarea'
import {
  approveApproval,
  cancelApproval,
  createApproval,
  deleteApproval,
  getApproval,
  rejectApproval,
  submitApproval,
  updateApproval,
  type Approval,
} from './approvals.api'
import {
  formatDate,
  newForm,
  sourcePathOf,
  stepStatus,
  toForm,
  toPayload,
  type ApprovalFormState,
} from './approvalForm'
import { ApprovalLineEditor } from './ApprovalLineEditor'
import type { ApprovalDraft } from './snapshot'

const titles: Record<FormMode, string> = {
  create: '결재 작성',
  edit: '결재 수정',
  view: '결재 조회',
}

function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      {message}
    </div>
  ) : null
}

export function ApprovalFormPage({ mode }: { mode: FormMode }) {
  const { user } = useAuth()
  const id = useParams().approvalId
  const location = useLocation()
  const sourceSyncWarning = (
    location.state as { sourceSyncWarning?: string } | null
  )?.sourceSyncWarning
  const prefill = (location.state as { prefill?: ApprovalDraft } | null)
    ?.prefill
  const [approval, setApproval] = useState<Approval | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getApproval(id)
      .then((data) => active && setApproval(data))
      .catch((error) => active && setLoadError(toMessage(error)))
    return () => {
      active = false
    }
  }, [mode, id])

  if (mode === 'create') {
    return (
      <ApprovalEditor
        mode="create"
        initial={{
          ...newForm(),
          ...(prefill && {
            refModule: prefill.refModule,
            refId: prefill.refId,
            title: prefill.title,
            contentJson: prefill.contentJson,
            attachmentId: prefill.attachmentId ?? null,
            sourceAttachmentIds: prefill.sourceAttachmentIds,
            ...(prefill.steps && {
              line: prefill.steps.map((step) => ({
                ...step,
                userName: step.userId,
                deptId: '',
                deptName: '',
                title: '',
                position: '',
              })),
            }),
          }),
        }}
      />
    )
  }

  if (loadError) {
    return <ErrorBox message={loadError} />
  }
  if (!approval || approval.approvalId !== id) {
    return <div className="p-4 text-xs text-slate-500">불러오는 중…</div>
  }
  if (
    mode === 'edit' ||
    (approval.status === 'D' && approval.submitterId === user?.userId)
  ) {
    if (approval.submitterId !== user?.userId || approval.status !== 'D') {
      return <Navigate to={`/approvals/${approval.approvalId}`} replace />
    }
    return (
      <ApprovalEditor
        key={approval.approvalId}
        mode="edit"
        initial={toForm(approval)}
        onSaved={setApproval}
      />
    )
  }
  return (
    <ApprovalView
      key={approval.approvalId}
      approval={approval}
      onChange={setApproval}
      initialWarning={sourceSyncWarning}
    />
  )
}

function ApprovalEditor({
  mode,
  initial,
  onSaved,
}: {
  mode: 'create' | 'edit'
  initial: ApprovalFormState
  onSaved?: (approval: Approval) => void
}) {
  const navigate = useNavigate()

  const [form, setForm] = useState(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  const formRef = useRef<HTMLFormElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPermitApproval = form.refModule === 'PERMIT'
  const isLinkedApproval = Boolean(form.refModule?.trim() && form.refId?.trim())

  const patch = (changes: Partial<ApprovalFormState>) =>
    setForm((current) => ({ ...current, ...changes }))
  const { user } = useAuth()
  const save = async (submit: boolean) => {
    // 연계 결재는 버튼이나 Enter 제출로 임시저장하지 않고 상신 시에만 저장한다.
    if (!submit && isLinkedApproval) return
    if (isSaving || isAttachmentBusy || !formRef.current?.reportValidity()) {
      return
    }
    if (!form.title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    if (form.line.length === 0) {
      setError('결재자 또는 합의자를 한 명 이상 추가해 주세요.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const payload = toPayload(form)
      let saved: Approval
      if (mode === 'edit') {
        saved = await updateApproval(form.approvalId, payload)
        if (submit) {
          saved = await submitApproval(form.approvalId)
        }
      } else {
        saved = await createApproval({
          ...payload,
          submit,
        })
      }
      const next = toForm(saved)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setIsSaving(false)
      onSaved?.(saved)
      navigate(`/approvals/${saved.approvalId}`, {
        replace: mode === 'create',
        state: { sourceSyncWarning: saved.sourceSyncWarning },
      })
    } catch (saveError) {
      setError(toMessage(saveError))
      setIsSaving(false)
    }
  }

  const removeDraft = async () => {
    if (
      mode !== 'edit' ||
      isSaving ||
      isAttachmentBusy ||
      !window.confirm('초안 문서를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    try {
      await deleteApproval(form.approvalId)
      navigate('/approvals')
    } catch (error) {
      setError(toMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{titles[mode]}</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving || isAttachmentBusy}
            onClick={() => {
              if (confirmLeave()) navigate('/approvals')
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || isSaving || isAttachmentBusy}
            onClick={() =>
              printDocument({
                title: form.title,
                fields: [
                  ['문서번호', form.approvalId],
                  ['관리번호', form.documentNo],
                ],
                contentJson: form.contentJson,
              })
            }
          >
            인쇄
          </Button>
          {mode === 'edit' && (
            <Button
              className="sm:ml-2"
              type="button"
              variant="danger"
              disabled={isSaving || isAttachmentBusy}
              onClick={() => void removeDraft()}
            >
              삭제
            </Button>
          )}
          <Button
            variant="secondary"
            type="submit"
            form="approval-form"
            disabled={isLinkedApproval || isSaving || isAttachmentBusy}
            title={
              isLinkedApproval
                ? '연계 결재는 임시저장 없이 상신합니다.'
                : undefined
            }
          >
            임시저장
          </Button>
          <Button
            type="button"
            disabled={isSaving || isAttachmentBusy}
            onClick={() => void save(true)}
          >
            상신
          </Button>
        </div>
      </div>
      <ErrorBox message={error} />
      <form
        id="approval-form"
        ref={formRef}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          void save(false)
        }}
      >
        <DocumentIdField
          value={form.approvalId}
          documentNo={form.documentNo}
          onDocumentNoChange={(documentNo) => patch({ documentNo })}
          disabled={isSaving || isAttachmentBusy}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="제목" required className="md:col-span-2">
            <Input
              value={form.title}
              disabled={isPermitApproval}
              required
              onChange={(event) => patch({ title: event.target.value })}
              autoFocus
            />
          </Field>
          <ApprovalLineEditor
            line={form.line}
            references={form.references}
            submitterId={user?.userId ?? ''}
            disabled={isSaving || isAttachmentBusy}
            onChange={patch}
            onError={setError}
          />
          <div className="space-y-2 md:col-span-2">
            <h2 className="text-base font-semibold">
              본문 <span className="text-red-600">*</span>
            </h2>
            <RichTextEditor
              value={form.contentJson}
              readOnly={isPermitApproval}
              onChange={(contentJson) => patch({ contentJson })}
            />
          </div>
          <div className="md:col-span-2">
            {(form.sourceAttachmentIds ?? []).map((id) => (
              <AttachmentManager
                key={id}
                attachmentId={id}
                refModule="PERREQ"
                refId={form.refId!}
                disabled
                onAttachmentIdChange={() => undefined}
                onError={setError}
              />
            ))}
            <AttachmentManager
              attachmentId={form.attachmentId}
              refModule="APPROV"
              refId={form.approvalId || null}
              disabled={isLinkedApproval || isSaving}
              onBusyChange={setIsAttachmentBusy}
              onAttachmentIdChange={(attachmentId) => patch({ attachmentId })}
              onError={setError}
            />
          </div>
        </div>
      </form>
    </section>
  )
}

type ApprovalAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'delete'

function ApprovalView({
  approval,
  onChange,
  initialWarning,
}: {
  approval: Approval
  onChange: (approval: Approval) => void
  initialWarning?: string
}) {
  const { approvalStepTypes } = useMetadata()
  const stepLabels = Object.fromEntries(
    approvalStepTypes.map(({ value, label }) => [value, label]),
  )
  const documentStatusLabels = useStatusLabels()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(
    initialWarning ?? approval.sourceSyncWarning ?? null,
  )

  const currentStep = useMemo(
    () =>
      approval.steps
        .filter(
          (step) =>
            (step.type === 'APPROVER' || step.type === 'AGREE') &&
            (step.status === null || step.status.trim() === ''),
        )
        .sort((a, b) => a.stepNo - b.stepNo)[0],
    [approval],
  )

  const isAgree = currentStep?.type === 'AGREE'
  const isSubmitter = approval.submitterId === user?.userId
  const isDraft = approval.status === 'D'
  const canEdit = isSubmitter && isDraft
  const canDelete = isSubmitter && isDraft
  const canCancel = isSubmitter && approval.status === 'P'
  const canProcess =
    approval.status === 'P' && currentStep?.userId === user?.userId
  const sourcePath = sourcePathOf(approval)

  const run = async (action: ApprovalAction) => {
    if (
      action === 'delete' &&
      !window.confirm('초안 문서를 삭제하시겠습니까?')
    ) {
      return
    }
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const id = approval.approvalId
      if (action === 'delete') {
        await deleteApproval(id)
        navigate('/approvals')
        return
      }
      const saved =
        action === 'submit'
          ? await submitApproval(id)
          : action === 'approve'
            ? await approveApproval(id, { comment })
            : action === 'reject'
              ? await rejectApproval(id, { comment })
              : await cancelApproval(id)
      setComment('')
      setNotice(
        saved.sourceSyncWarning ??
          {
            submit: '상신했습니다.',
            approve: isAgree ? '동의했습니다.' : '승인했습니다.',
            reject: isAgree ? '부동의 처리했습니다.' : '반려했습니다.',
            cancel: '상신을 취소했습니다.',
            delete: '삭제했습니다.',
          }[action],
      )
      onChange(saved)
    } catch (actionError) {
      setError(toMessage(actionError))
    } finally {
      setIsSaving(false)
    }
  }

  const displaySteps = [...approval.steps].sort(
    (a, b) =>
      Number(a.type === 'REFERENCE') - Number(b.type === 'REFERENCE') ||
      a.stepNo - b.stepNo,
  )
  const processingSteps = displaySteps.filter(
    (step) => step.type === 'APPROVER' || step.type === 'AGREE',
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="break-words">{approval.title}</span>
          <StatusBadge status={approval.status} />
        </h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => navigate('/approvals')}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() =>
              printDocument({
                title: approval.title,
                fields: [
                  ['문서번호', approval.approvalId],
                  ['관리번호', approval.documentNo],
                  ['상신자', approval.submitterId],
                  [
                    '상태',
                    documentStatusLabels[approval.status] ?? approval.status,
                  ],
                ],
                contentJson: approval.contentJson,
              })
            }
          >
            인쇄
          </Button>
          {sourcePath && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(sourcePath)}
            >
              원문 보기
            </Button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="danger"
              className="sm:ml-2"
              disabled={isSaving}
              onClick={() => void run('cancel')}
            >
              상신 취소
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="danger"
              className="sm:ml-2"
              disabled={isSaving}
              onClick={() => void run('delete')}
            >
              삭제
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void run('submit')}
            >
              상신
            </Button>
          )}
        </div>
      </div>
      <DocumentIdField
        value={approval.approvalId}
        documentNo={approval.documentNo}
        readOnly
      />
      <ErrorBox message={error} />
      {notice && !error && (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
        >
          {notice}
        </div>
      )}
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-700 md:p-5">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">결재선</h2>
          <p className="text-xs text-slate-500">
            참조자는 승인 완료 후 열람하며 결재 차례에 포함되지 않습니다.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-slate-50 text-sm text-slate-700">
                <tr>
                  <th className="w-14 px-3 py-2 text-center font-medium">
                    순서
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    사용자 / 부서
                  </th>
                  <th className="px-3 py-2 text-left font-medium">유형</th>
                  <th className="px-3 py-2 text-center font-medium">
                    처리 상태
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    처리일시 / 의견
                  </th>
                </tr>
              </thead>
              <tbody>
                {displaySteps.map((step) => {
                  const current =
                    approval.status === 'P' &&
                    step.stepNo === currentStep?.stepNo
                  return (
                    <tr
                      key={step.stepNo}
                      className={`border-t border-slate-100 ${current ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2 text-center">
                        {step.type === 'REFERENCE' || step.type === 'SUBMITTER'
                          ? '—'
                          : processingSteps.indexOf(step) + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">
                          {step.userName || step.userId}
                        </div>
                        <div className="text-slate-500">
                          {[step.deptName, step.title, step.position]
                            .filter(Boolean)
                            .join(' / ')}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {stepLabels[step.type] ?? step.type}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {current ? '현재 차례' : stepStatus(step)}
                      </td>
                      <td className="px-3 py-2">
                        <div>
                          {step.type === 'REFERENCE'
                            ? '—'
                            : formatDate(step.actedAt)}
                        </div>
                        {step.comment && (
                          <div className="mt-1 whitespace-pre-wrap break-words text-slate-500">
                            {step.comment}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-slate-900">본문</h2>
          <RichTextEditor value={approval.contentJson} readOnly />
        </section>
        {(approval.sourceAttachmentIds ?? []).map((id) => (
          <AttachmentManager
            key={id}
            attachmentId={id}
            refModule="PERREQ"
            refId={approval.refId!}
            disabled
            onAttachmentIdChange={() => undefined}
            onError={setError}
          />
        ))}
        <AttachmentManager
          attachmentId={approval.attachmentId}
          refModule="APPROV"
          refId={approval.approvalId}
          disabled
          onAttachmentIdChange={() => undefined}
          onError={setError}
        />
        {canProcess && (
          <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
            <Field label="결재 의견">
              <Textarea
                value={comment}
                disabled={isSaving}
                onChange={(event) => setComment(event.target.value)}
                placeholder="검토 의견을 입력해 주세요."
              />
            </Field>
            <div className="page-actions">
              <Button
                type="button"
                variant="danger"
                disabled={isSaving}
                onClick={() => void run('reject')}
              >
                {isAgree ? '부동의' : '반려'}
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void run('approve')}
              >
                {isAgree ? '동의' : '승인'}
              </Button>
            </div>
          </section>
        )}
        <details className="border-t border-slate-100 pt-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            작성·처리 정보
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="상신자" value={approval.submitterId} />
            <Info label="작성일시" value={formatDate(approval.createdAt)} />
            <Info label="상신일시" value={formatDate(approval.submittedAt)} />
            <Info label="종결일시" value={formatDate(approval.completedAt)} />
          </div>
        </details>
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="break-words text-xs text-slate-800">
        {value === '' || value == null ? '-' : value}
      </div>
    </div>
  )
}
