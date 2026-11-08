import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
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
import { Select } from '@/shared/ui/Select'
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
  type ApprovalUserInfo,
} from './approvals.api'
import {
  formatDate,
  newForm,
  sourcePathOf,
  stepStatus,
  toForm,
  toPayload,
  stepFromUser,
  type ApprovalFormState,
  type ApprovalFormStep,
} from './approvalForm'
import { UserSearchBox } from './UserSearchBox'
import type { ApprovalDraft } from './snapshot'

const titles: Record<FormMode, string> = {
  create: '결재 작성',
  edit: '결재 수정',
  view: '결재 조회',
}

function UserLabel({ step }: { step: ApprovalFormStep }) {
  return (
    <div className="min-w-0 truncate">
      <span className="font-medium text-slate-900">{step.userName}</span>{' '}
      <span className="text-slate-500">({step.userId})</span>
      <span className="ml-2 text-slate-500">
        {[step.deptName, step.title, step.position].filter(Boolean).join(' / ')}
      </span>
    </div>
  )
}

function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      {message}
    </div>
  ) : null
}

export function ApprovalFormPage({ mode }: { mode: FormMode }) {
  const { user } = useAuth()
  const id = useParams().approvalId
  const prefill = (useLocation().state as { prefill?: ApprovalDraft } | null)
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
    return <div className="p-4 text-xs text-slate-500">Loading...</div>
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
  return <ApprovalView approval={approval} onChange={setApproval} />
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
  const [requestKey] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState(initial)
  const [baseline, setBaseline] = useState(JSON.stringify(initial))
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  const formRef = useRef<HTMLFormElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isPermitApproval = form.refModule === 'work_permit'
  const isLinkedApproval = Boolean(form.refModule?.trim() && form.refId?.trim())

  const patch = (changes: Partial<ApprovalFormState>) =>
    setForm((current) => ({ ...current, ...changes }))
  const { user } = useAuth()
  const taken = [
    user?.userId ?? '',
    ...form.line.map((step) => step.userId),
    ...form.references.map((step) => step.userId),
  ]
  const addToLine = (info: ApprovalUserInfo) =>
    patch({ line: [...form.line, stepFromUser(info, 'APPROVER')] })
  const addReference = (info: ApprovalUserInfo) =>
    patch({ references: [...form.references, stepFromUser(info, 'REFERENCE')] })
  const changeLineType = (index: number, type: ApprovalFormStep['type']) =>
    patch({
      line: form.line.map((step, i) =>
        i === index ? { ...step, type } : step,
      ),
    })
  const moveLine = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= form.line.length) return
    const next = [...form.line]
    ;[next[index], next[target]] = [next[target], next[index]]
    patch({ line: next })
  }

  const save = async (submit: boolean) => {
    // 연계 결재는 버튼이나 Enter 제출로 임시저장하지 않고 상신 시에만 저장한다.
    if (!submit && isLinkedApproval) return
    if (isSaving || isAttachmentBusy || !formRef.current?.reportValidity()) {
      return
    }
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (form.line.length === 0) {
      setError('Add at least one approver to the approval line')
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
        saved = await createApproval(
          {
            ...payload,
            submit,
          },
          requestKey,
        )
      }
      const next = toForm(saved)
      setForm(next)
      setBaseline(JSON.stringify(next))
      setIsSaving(false)
      onSaved?.(saved)
      navigate(`/approvals/${saved.approvalId}`, { replace: mode === 'create' })
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
        <h1 className="text-base font-semibold text-slate-900">
          {titles[mode]}
        </h1>
        <div className="flex flex-wrap justify-end gap-2">
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
            type="submit"
            form="approval-form"
            disabled={isLinkedApproval || isSaving || isAttachmentBusy}
            title={
              isLinkedApproval
                ? '연계 결재는 임시저장 없이 상신합니다.'
                : undefined
            }
          >
            저장
          </Button>
          {mode === 'edit' && (
            <Button
              type="button"
              variant="danger"
              disabled={isSaving || isAttachmentBusy}
              onClick={() => void removeDraft()}
            >
              삭제
            </Button>
          )}
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
        className="border border-slate-200 bg-white p-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          void save(false)
        }}
      >
        <DocumentIdField value={form.approvalId} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="관리번호" className="md:col-span-2">
            <Input
              value={form.documentNo}
              maxLength={50}
              onChange={(event) => patch({ documentNo: event.target.value })}
            />
          </Field>
          <Field label="Title" required className="md:col-span-2">
            <Input
              value={form.title}
              disabled={isPermitApproval}
              required
              onChange={(event) => patch({ title: event.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Content" required className="md:col-span-2">
            <RichTextEditor
              value={form.contentJson}
              readOnly={isPermitApproval}
              onChange={(contentJson) => patch({ contentJson })}
            />
          </Field>
          <fieldset
            disabled={isPermitApproval}
            className="space-y-2 md:col-span-2"
          >
            <div className="text-xs font-medium text-slate-700">
              Approval line
              <span className="ml-2 font-normal text-slate-500">
                Processed in order. Approver approves or rejects; Agree reviews
                and agrees or disagrees.
              </span>
            </div>
            <UserSearchBox
              placeholder="Search by user ID or name to add to the line"
              excludeUserIds={taken}
              onSelect={addToLine}
              onError={setError}
            />
            <div className="grid gap-1">
              {form.line.length === 0 && (
                <div className="border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                  No approvers yet.
                </div>
              )}
              {form.line.map((step, index) => (
                <div
                  key={step.userId}
                  className="grid grid-cols-[28px_minmax(0,1fr)_110px_auto] items-center gap-2 border border-slate-200 px-2 py-1 text-xs"
                >
                  <span className="text-center font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <UserLabel step={step} />
                  <Select
                    value={step.type}
                    onChange={(event) =>
                      changeLineType(
                        index,
                        event.target.value as ApprovalFormStep['type'],
                      )
                    }
                  >
                    <option value="APPROVER">결재</option>
                    <option value="AGREE">합의</option>
                  </Select>
                  <div className="flex">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => moveLine(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === form.line.length - 1}
                      onClick={() => moveLine(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        patch({ line: form.line.filter((_, i) => i !== index) })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2 md:col-span-2">
            <div className="text-xs font-medium text-slate-700">
              References
              <span className="ml-2 font-normal text-slate-500">
                Can view approved documents only; no approval action required.
              </span>
            </div>
            <UserSearchBox
              placeholder="Search by user ID or name to add a reference"
              excludeUserIds={taken}
              onSelect={addReference}
              onError={setError}
            />
            <div className="grid gap-1">
              {form.references.map((step, index) => (
                <div
                  key={step.userId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-slate-200 px-2 py-1 text-xs"
                >
                  <UserLabel step={step} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      patch({
                        references: form.references.filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {(form.sourceAttachmentIds ?? []).map((id) => (
              <AttachmentManager
                key={id}
                attachmentId={id}
                refModule="work_permit_request"
                refId={form.refId!}
                disabled
                onAttachmentIdChange={() => undefined}
                onError={setError}
              />
            ))}
            <AttachmentManager
              attachmentId={form.attachmentId}
              refModule="approval"
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
}: {
  approval: Approval
  onChange: (approval: Approval) => void
}) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
      if (action === 'submit') await submitApproval(id)
      if (action === 'approve') await approveApproval(id, { comment })
      if (action === 'reject') await rejectApproval(id, { comment })
      if (action === 'cancel') await cancelApproval(id)
      setComment('')
      setNotice(
        {
          submit: '상신했습니다.',
          approve: '승인했습니다.',
          reject: isAgree ? '부동의 처리했습니다.' : '반려했습니다.',
          cancel: '상신을 취소했습니다.',
          delete: '삭제했습니다.',
        }[action],
      )
      onChange(await getApproval(id))
    } catch (actionError) {
      setError(toMessage(actionError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <DocumentIdField value={approval.approvalId} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {approval.title}
          <StatusBadge status={approval.status} />
        </h1>
        <div className="flex flex-wrap justify-end gap-2">
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
                  ['상태', approval.status],
                ],
                contentJson: approval.contentJson,
              })
            }
          >
            인쇄
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => navigate('/approvals')}
          >
            목록
          </Button>
          {sourcePath && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(sourcePath)}
            >
              원문
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
          {canProcess && (
            <>
              <Button
                type="button"
                disabled={isSaving}
                onClick={() => void run('approve')}
              >
                승인
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isSaving}
                onClick={() => void run('reject')}
              >
                {isAgree ? '부동의' : '반려'}
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="danger"
              disabled={isSaving}
              onClick={() => void run('cancel')}
            >
              상신취소
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="danger"
              disabled={isSaving}
              onClick={() => void run('delete')}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      <ErrorBox message={error} />
      {notice && !error && (
        <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      <div className="space-y-3 border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <RichTextEditor value={approval.contentJson} readOnly />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Info label="관리번호" value={approval.documentNo || '-'} />
          <Info label="Submitter" value={approval.submitterId} />
          <Info label="Created" value={formatDate(approval.createdAt)} />
          <Info label="Submitted" value={formatDate(approval.submittedAt)} />
          <Info label="Completed" value={formatDate(approval.completedAt)} />
        </div>

        <div>
          <div className="mb-1 font-semibold text-slate-900">Steps</div>
          <div className="grid gap-1">
            {approval.steps.map((step) => (
              <div
                key={`${step.approvalId}-${step.stepNo}`}
                className="grid grid-cols-[48px_1fr_88px] gap-2 border border-slate-100 px-2 py-1"
              >
                <span>{step.stepNo}</span>
                <span>
                  {step.type === 'AGREE'
                    ? 'Agree'
                    : step.type === 'APPROVER'
                      ? 'Approve'
                      : step.type === 'REFERENCE'
                        ? 'Reference'
                        : 'Submitter'}{' '}
                  / {step.userId}
                  {step.userName &&
                    ` · ${[step.userName, step.deptName, step.title, step.position].filter(Boolean).join(' / ')}`}
                </span>
                <span>{stepStatus(step)}</span>
              </div>
            ))}
          </div>
        </div>

        {(approval.sourceAttachmentIds ?? []).map((id) => (
          <AttachmentManager
            key={id}
            attachmentId={id}
            refModule="work_permit_request"
            refId={approval.refId!}
            disabled
            onAttachmentIdChange={() => undefined}
            onError={setError}
          />
        ))}
        <AttachmentManager
          attachmentId={approval.attachmentId}
          refModule="approval"
          refId={approval.approvalId}
          disabled
          onAttachmentIdChange={() => undefined}
          onError={setError}
        />

        {canProcess && (
          <Field label="Action Comment">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
        )}
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="break-words text-xs text-slate-800">
        {value === '' || value == null ? '-' : value}
      </div>
    </div>
  )
}
