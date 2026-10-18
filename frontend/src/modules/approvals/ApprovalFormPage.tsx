import {
  ArrowDown,
  ArrowUp,
  Check,
  Edit3,
  Eye,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AttachmentManager } from '@/modules/attachments'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import type { FormMode } from '@/shared/types/form'
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
  contentToText,
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
  create: 'New Approval',
  edit: 'Edit Approval',
  view: 'Approval',
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
  const { hasPermission } = useAuth()
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
    if (!hasPermission('approval:create')) {
      return <Navigate to="/approvals" replace />
    }
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
  if (mode === 'edit') {
    if (!hasPermission('approval:update') || approval.status !== 'D') {
      return <Navigate to={`/approvals/${approval.approvalId}`} replace />
    }
    return <ApprovalEditor mode="edit" initial={toForm(approval)} />
  }
  return <ApprovalView approval={approval} onChange={setApproval} />
}

function ApprovalEditor({
  mode,
  initial,
}: {
  mode: 'create' | 'edit'
  initial: ApprovalFormState
}) {
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        saved = await createApproval({
          ...payload,
          approvalId: form.approvalId,
          submit,
        })
      }
      navigate(`/approvals/${saved.approvalId}`)
    } catch (saveError) {
      setError(toMessage(saveError))
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <h1 className="text-base font-semibold text-slate-900">{titles[mode]}</h1>
      <ErrorBox message={error} />
      <form
        className="border border-slate-200 bg-white p-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          void save(false)
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Title" required className="md:col-span-2">
            <Input
              value={form.title}
              required
              onChange={(event) => patch({ title: event.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Content" required className="md:col-span-2">
            <RichTextEditor
              value={form.contentJson}
              onChange={(contentJson) => patch({ contentJson })}
            />
          </Field>
          <div className="space-y-2 md:col-span-2">
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
                    <option value="APPROVER">Approve</option>
                    <option value="AGREE">Agree</option>
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
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="text-xs font-medium text-slate-700">
              References
              <span className="ml-2 font-normal text-slate-500">
                Notified after the approval is completed or rejected.
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
            <AttachmentManager
              attachmentId={form.attachmentId}
              refModule="approval"
              refId={form.approvalId}
              disabled={isSaving}
              onAttachmentIdChange={(attachmentId) => patch({ attachmentId })}
              onError={setError}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={() => void save(true)}
          >
            <Send className="h-4 w-4" />
            Save + Submit
          </Button>
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
  const { user, hasPermission } = useAuth()
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
  const canUpdate = hasPermission('approval:update')
  const isSubmitter = approval.submitterId === user?.userId
  const isDraft = approval.status === 'D'
  const canEdit = canUpdate && isSubmitter && isDraft
  const canDelete = hasPermission('approval:delete') && isSubmitter && isDraft
  const canCancel = canUpdate && isSubmitter && approval.status === 'P'
  const canProcess =
    canUpdate && approval.status === 'P' && currentStep?.userId === user?.userId
  const sourcePath = sourcePathOf(approval)

  const run = async (action: ApprovalAction) => {
    if (action === 'delete' && !window.confirm('Delete this draft approval?')) {
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
      setNotice(`Approval ${action}${action.endsWith('e') ? 'd' : 'ed'}`)
      onChange(await getApproval(id))
    } catch (actionError) {
      setError(toMessage(actionError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          {approval.title}
          <StatusBadge status={approval.status} />
        </h1>
        <Button variant="secondary" onClick={() => navigate('/approvals')}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      <ErrorBox message={error} />
      {notice && !error && (
        <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {notice}
        </div>
      )}

      <div className="space-y-3 border border-slate-200 bg-white p-3 text-xs text-slate-700">
        <div className="whitespace-pre-wrap text-slate-600">
          {contentToText(approval.contentJson)}
        </div>
        {sourcePath && (
          <Button variant="secondary" onClick={() => navigate(sourcePath)}>
            <Eye className="h-4 w-4" />
            View source
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Info label="Submitter" value={approval.submitterId} />
          <Info label="Created" value={formatDate(approval.createdAt)} />
          <Info label="Submitted" value={formatDate(approval.submittedAt)} />
          <Info label="Completed" value={formatDate(approval.completedAt)} />
        </div>

        <div>
          <div className="mb-1 font-semibold text-slate-900">Steps</div>
          <div className="grid gap-1">
            {approval.steps
              .filter(
                (step) =>
                  step.type !== 'REFERENCE' ||
                  ['C', 'R'].includes(approval.status),
              )
              .map((step) => (
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

        {approval.attachmentId && (
          <AttachmentManager
            attachmentId={approval.attachmentId}
            refModule="approval"
            refId={approval.approvalId}
            disabled
            onAttachmentIdChange={() => undefined}
            onError={setError}
          />
        )}

        {canProcess && (
          <Field label="Action Comment">
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('edit')}
                disabled={isSaving}
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => void run('submit')}
                disabled={isSaving}
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            </>
          )}
          {canProcess && (
            <>
              <Button
                size="sm"
                onClick={() => void run('approve')}
                disabled={isSaving}
              >
                <Check className="h-4 w-4" />
                {isAgree ? 'Agree' : 'Approve'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void run('reject')}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                {isAgree ? 'Disagree' : 'Reject'}
              </Button>
            </>
          )}
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void run('cancel')}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          )}
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void run('delete')}
              disabled={isSaving}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
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
