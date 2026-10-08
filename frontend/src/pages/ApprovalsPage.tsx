import {
  Check,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { FormEvent, ReactNode } from 'react'
import {
  approveApproval,
  cancelApproval,
  createApproval,
  deleteApproval,
  getApproval,
  getApprovalBox,
  rejectApproval,
  submitApproval,
  updateApproval,
  type Approval,
  type ApprovalBox,
  type ApprovalPayload,
  type ApprovalStep,
  type ApprovalStepPayload,
} from '../api/approvals.api'
import { toMessage } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import { AttachmentManager } from '../components/AttachmentManager'
import { RichTextEditor } from '../components/RichTextEditor'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Textarea } from '../components/ui/Textarea'
import { documentModules } from '../documents/registry'
import type { ApprovalDraft } from '../documents/snapshot'
import { documentStatusLabels } from '../types/document'

interface ApprovalFormState {
  approvalId: string
  refModule: string | null
  refId: string | null
  title: string
  contentJson: unknown
  attachmentId: string | null
  steps: ApprovalStepPayload[]
  note: string
  submit: boolean
}

const boxes: { key: ApprovalBox; label: string }[] = [
  { key: 'submit', label: 'Submitted' },
  { key: 'pending', label: 'Pending' },
  { key: 'processed', label: 'Processed' },
  { key: 'closed', label: 'Closed' },
  { key: 'reference', label: 'Reference' },
]

const emptyForm: ApprovalFormState = {
  approvalId: '',
  refModule: null,
  refId: null,
  title: '',
  contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  attachmentId: null,
  steps: [{ type: 'APPROVER', userId: '' }],
  note: '',
  submit: false,
}

function stepsFromForm(form: ApprovalFormState): ApprovalStepPayload[] {
  const seen = new Set<string>()
  return form.steps
    .map((step) => ({
      type: step.type,
      userId: step.userId.trim(),
    }))
    .filter((step) => {
      const key = `${step.type}:${step.userId}`
      if (!step.userId || seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
}

function contentToText(contentJson: unknown) {
  if (
    typeof contentJson === 'object' &&
    contentJson !== null &&
    'text' in contentJson &&
    typeof contentJson.text === 'string'
  ) {
    return contentJson.text
  }
  if (typeof contentJson === 'string') {
    return contentJson
  }
  if (typeof contentJson === 'object' && contentJson !== null) {
    const textParts: string[] = []
    const walk = (node: unknown) => {
      if (typeof node !== 'object' || node === null) {
        return
      }
      if ('text' in node && typeof node.text === 'string') {
        textParts.push(node.text)
      }
      if ('content' in node && Array.isArray(node.content)) {
        node.content.forEach(walk)
      }
      if ('type' in node && node.type === 'paragraph') {
        textParts.push('\n')
      }
    }
    walk(contentJson)
    return textParts.join('').trim()
  }
  return ''
}

function toForm(approval: Approval): ApprovalFormState {
  return {
    approvalId: approval.approvalId,
    refModule: approval.refModule,
    refId: approval.refId,
    title: approval.title,
    contentJson: approval.contentJson,
    attachmentId: approval.attachmentId,
    steps:
      approval.steps
        .filter(
          (
            step,
          ): step is ApprovalStep & {
            type: ApprovalStepPayload['type']
          } => step.type === 'APPROVER' || step.type === 'REFERENCE',
        )
        .map((step) => ({ type: step.type, userId: step.userId })) || [],
    note: approval.note ?? '',
    submit: false,
  }
}

function toPayload(form: ApprovalFormState): ApprovalPayload {
  return {
    refModule: form.refModule,
    refId: form.refId,
    title: form.title,
    contentJson: form.contentJson,
    attachmentId: form.attachmentId,
    note: form.note,
    steps: stepsFromForm(form),
    submit: form.submit,
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

function stepStatus(step: ApprovalStep) {
  if (step.type === 'SUBMITTER' && step.status === 'Y') {
    return 'Submitted'
  }
  if (step.status === 'Y') {
    return 'Approved'
  }
  if (step.status === 'N') {
    return 'Rejected'
  }
  if (step.type === 'REFERENCE') {
    return 'Reference'
  }
  return 'Waiting'
}

export function ApprovalsPage() {
  const { user, hasPermission } = useAuth()
  const [activeBox, setActiveBox] = useState<ApprovalBox>('submit')
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [editingApproval, setEditingApproval] = useState<Approval | null>(null)
  const prefill = (useLocation().state as { prefill?: ApprovalDraft } | null)
    ?.prefill
  const [form, setForm] = useState<ApprovalFormState>(() =>
    prefill
      ? {
          ...emptyForm,
          ...prefill,
          approvalId: crypto.randomUUID(),
          steps: [{ type: 'APPROVER', userId: '' }],
        }
      : emptyForm,
  )
  const [documentViewOpen, setDocumentViewOpen] = useState(false)
  const [actionComment, setActionComment] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(Boolean(prefill))
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const canCreate = hasPermission('approval:create')
  const canUpdate = hasPermission('approval:update')
  const canDelete = hasPermission('approval:delete')

  const loadBox = useCallback(async (box: ApprovalBox, keepSelection = false) => {
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const data = await getApprovalBox(box)
      setApprovals(data)
      if (!keepSelection) {
        setSelectedApproval(data[0] ?? null)
      }
    } catch (loadError) {
      setError(toMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getApprovalBox(activeBox)
      .then((data) => {
        if (active) {
          setApprovals(data)
          setSelectedApproval(data[0] ?? null)
        }
      })
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [activeBox])

  const selectBox = (box: ApprovalBox) => {
    setActiveBox(box)
    setIsLoading(true)
    setError(null)
    setNotice(null)
  }

  const selectedCurrentStep = useMemo(() => {
    if (!selectedApproval) {
      return undefined
    }
    return selectedApproval.steps
      .filter(
        (step) =>
          step.type === 'APPROVER' &&
          (step.status === null || step.status.trim() === ''),
      )
      .sort((a, b) => a.stepNo - b.stepNo)[0]
  }, [selectedApproval])

  const isSubmitter = selectedApproval?.submitterId === user?.userId
  const canSubmitSelected =
    canUpdate && isSubmitter && selectedApproval?.status === 'D'
  const canEditSelected = canSubmitSelected
  const canDeleteSelected =
    canDelete && isSubmitter && selectedApproval?.status === 'D'
  const canCancelSelected =
    canUpdate && isSubmitter && selectedApproval?.status === 'P'
  const canProcessSelected =
    canUpdate &&
    selectedApproval?.status === 'P' &&
    selectedCurrentStep?.userId === user?.userId

  const linkedModule =
    selectedApproval?.refModule && selectedApproval.refId
      ? documentModules[selectedApproval.refModule]
      : undefined
  const canOpenLinked = linkedModule
    ? hasPermission(linkedModule.readPermission)
    : false

  const openNewForm = () => {
    setEditingApproval(null)
    setForm({
      ...emptyForm,
      approvalId: crypto.randomUUID(),
      steps: [{ type: 'APPROVER', userId: '' }],
    })
    setIsFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const openEditForm = () => {
    if (!selectedApproval) {
      return
    }
    setEditingApproval(selectedApproval)
    setForm(toForm(selectedApproval))
    setIsFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setEditingApproval(null)
    setForm({ ...emptyForm, steps: [{ type: 'APPROVER', userId: '' }] })
  }

  const reloadSelected = async (approvalId: string) => {
    const freshApproval = await getApproval(approvalId)
    setSelectedApproval(freshApproval)
    setApprovals((current) =>
      current.map((approval) =>
        approval.approvalId === approvalId ? freshApproval : approval,
      ),
    )
    return freshApproval
  }

  const saveApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = toPayload(form)
      const savedApproval = editingApproval
        ? await updateApproval(editingApproval.approvalId, payload)
        : await createApproval({ ...payload, approvalId: form.approvalId })
      setSelectedApproval(savedApproval)
      setIsFormOpen(false)
      setEditingApproval(null)
      setNotice(editingApproval ? 'Approval updated' : 'Approval created')
      await loadBox(activeBox, true)
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const runApprovalAction = async (
    action: 'submit' | 'approve' | 'reject' | 'cancel' | 'delete',
  ) => {
    if (!selectedApproval) {
      return
    }

    if (
      action === 'delete' &&
      !window.confirm('Delete this draft approval?')
    ) {
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (action === 'submit') {
        await submitApproval(selectedApproval.approvalId)
        setNotice('Approval submitted')
      }
      if (action === 'approve') {
        await approveApproval(selectedApproval.approvalId, {
          comment: actionComment,
        })
        setActionComment('')
        setNotice('Approval approved')
      }
      if (action === 'reject') {
        await rejectApproval(selectedApproval.approvalId, {
          comment: actionComment,
        })
        setActionComment('')
        setNotice('Approval rejected')
      }
      if (action === 'cancel') {
        await cancelApproval(selectedApproval.approvalId)
        setNotice('Approval cancelled')
      }
      if (action === 'delete') {
        await deleteApproval(selectedApproval.approvalId)
        setSelectedApproval(null)
        setNotice('Approval deleted')
      } else {
        await reloadSelected(selectedApproval.approvalId)
      }
      await loadBox(activeBox, true)
    } catch (actionError) {
      setError(toMessage(actionError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Approvals</h1>
          <p className="text-xs text-slate-500">
            Draft, submit, process, and review approval documents
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void loadBox(activeBox, true)}
            disabled={isLoading || isSaving}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openNewForm} disabled={!canCreate || isSaving}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {boxes.map((box) => (
          <button
            key={box.key}
            type="button"
            onClick={() => selectBox(box.key)}
            className={[
              'h-8 border-b-2 px-3 text-xs font-medium',
              activeBox === box.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {box.label}
          </button>
        ))}
      </div>

      {(error || notice) && (
        <div
          className={[
            'border px-3 py-2 text-xs',
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          ].join(' ')}
        >
          {error ?? notice}
        </div>
      )}

      {isFormOpen && (
        <form
          className="border border-slate-200 bg-white p-3"
          onSubmit={(event) => void saveApproval(event)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title" required className="md:col-span-2">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                autoFocus
              />
            </Field>
            <Field label="Content" required className="md:col-span-2">
              <RichTextEditor
                value={form.contentJson}
                onChange={(contentJson) =>
                  setForm((current) => ({
                    ...current,
                    contentJson,
                  }))
                }
              />
            </Field>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-slate-700">
                Approvers / References
              </div>
              <div className="grid gap-2">
                {form.steps.map((step, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_150px_auto] gap-2"
                  >
                    <Input
                      value={step.userId}
                      placeholder="User ID"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.map((currentStep, stepIndex) =>
                            stepIndex === index
                              ? { ...currentStep, userId: event.target.value }
                              : currentStep,
                          ),
                        }))
                      }
                    />
                    <Select
                      value={step.type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.map((currentStep, stepIndex) =>
                            stepIndex === index
                              ? {
                                  ...currentStep,
                                  type: event.target
                                    .value as ApprovalStepPayload['type'],
                                }
                              : currentStep,
                          ),
                        }))
                      }
                    >
                      <option value="APPROVER">Approver</option>
                      <option value="REFERENCE">Referencer</option>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={form.steps.length === 1}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          steps: current.steps.filter(
                            (_, stepIndex) => stepIndex !== index,
                          ),
                        }))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    steps: [
                      ...current.steps,
                      { type: 'APPROVER', userId: '' },
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </div>
            <div className="md:col-span-2">
              <AttachmentManager
                attachmentId={form.attachmentId}
                refModule="approval"
                refId={form.approvalId}
                disabled={isSaving}
                onAttachmentIdChange={(attachmentId) =>
                  setForm((current) => ({ ...current, attachmentId }))
                }
                onError={setError}
              />
            </div>
            <Field label="Note" className="md:col-span-2">
              <Textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          {!editingApproval && (
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.submit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    submit: event.target.checked,
                  }))
                }
              />
              Submit immediately
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <DataTable<Approval>
          gridTemplateColumns="130px 1fr 120px 90px"
          columns={[
            {
              key: 'createdAt',
              label: 'Created',
              render: (row) => formatDate(row.createdAt),
            },
            { key: 'title', label: 'Title', render: (row) => row.title },
            {
              key: 'submitter',
              label: 'Submitter',
              render: (row) => row.submitterId,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge status={row.status} />,
            },
          ]}
          rows={approvals}
          emptyText={isLoading ? 'Loading...' : 'No approvals'}
        />

        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Detail</h2>
              <p className="text-xs text-slate-500">
                {selectedApproval?.approvalId ?? 'No approval selected'}
              </p>
            </div>
            <div className="flex gap-1">
              {selectedApproval && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void reloadSelected(selectedApproval.approvalId)}
                >
                  <Eye className="h-4 w-4" />
                  Open
                </Button>
              )}
            </div>
          </div>

          <div className="border-b border-slate-200 p-2">
            <div className="grid max-h-44 overflow-auto">
              {approvals.map((approval) => (
                <button
                  key={approval.approvalId}
                  type="button"
                  onClick={() => setSelectedApproval(approval)}
                  className={[
                    'border-b border-slate-100 px-2 py-2 text-left text-xs last:border-b-0',
                    selectedApproval?.approvalId === approval.approvalId
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="block truncate font-medium">
                    {approval.title}
                  </span>
                  <span className="block text-slate-500">
                    {documentStatusLabels[approval.status]} / {approval.submitterId}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedApproval ? (
            <div className="space-y-3 p-3 text-xs text-slate-700">
              <div>
                <div className="font-semibold text-slate-900">
                  {selectedApproval.title}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-slate-600">
                  {contentToText(selectedApproval.contentJson)}
                </div>
              </div>
              {linkedModule && canOpenLinked && (
                <Button
                  variant="secondary"
                  onClick={() => setDocumentViewOpen(true)}
                >
                  <Eye className="h-4 w-4" />
                  Open {linkedModule.label}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Info
                label="Status"
                value={<StatusBadge status={selectedApproval.status} />}
              />
                <Info label="Submitter" value={selectedApproval.submitterId} />
                <Info
                  label="Submitted"
                  value={formatDate(selectedApproval.submittedAt)}
                />
                <Info
                  label="Completed"
                  value={formatDate(selectedApproval.completedAt)}
                />
              </div>

              <div>
                <div className="mb-1 font-semibold text-slate-900">Steps</div>
                <div className="grid gap-1">
                  {selectedApproval.steps.map((step) => (
                    <div
                      key={`${step.approvalId}-${step.stepNo}`}
                      className="grid grid-cols-[48px_1fr_88px] gap-2 border border-slate-100 px-2 py-1"
                    >
                      <span>{step.stepNo}</span>
                      <span>
                        {step.type} / {step.userId}
                      </span>
                      <span>{stepStatus(step)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedApproval.note && (
                <Info label="Note" value={selectedApproval.note} />
              )}

              {selectedApproval.attachmentId && (
                <AttachmentManager
                  attachmentId={selectedApproval.attachmentId}
                  refModule="approval"
                  refId={selectedApproval.approvalId}
                  disabled={!canEditSelected}
                  onAttachmentIdChange={() => undefined}
                  onError={setError}
                />
              )}

              {canProcessSelected && (
                <Field label="Action Comment">
                  <Textarea
                    value={actionComment}
                    onChange={(event) => setActionComment(event.target.value)}
                  />
                </Field>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {canEditSelected && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openEditForm}
                    disabled={isSaving}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                {canSubmitSelected && (
                  <Button
                    size="sm"
                    onClick={() => void runApprovalAction('submit')}
                    disabled={isSaving}
                  >
                    <Send className="h-4 w-4" />
                    Submit
                  </Button>
                )}
                {canProcessSelected && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void runApprovalAction('approve')}
                      disabled={isSaving}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void runApprovalAction('reject')}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
                {canCancelSelected && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void runApprovalAction('cancel')}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                )}
                {canDeleteSelected && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void runApprovalAction('delete')}
                    disabled={isSaving}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-xs text-slate-500">
              Select an approval
            </div>
          )}
        </div>
      </div>
      {documentViewOpen && linkedModule && selectedApproval?.refId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-full w-full max-w-3xl overflow-auto bg-white shadow-lg">
            <div className="flex justify-end border-b border-slate-200 p-1">
              <Button variant="ghost" onClick={() => setDocumentViewOpen(false)}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
            {linkedModule.renderView(selectedApproval.refId)}
          </div>
        </div>
      )}
    </section>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="break-words text-xs text-slate-800">{value === '' || value == null ? '-' : value}</div>
    </div>
  )
}
