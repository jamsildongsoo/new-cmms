import { dateInput, dateValue } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { PRIORITIES } from './priority'
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import type { FormMode } from '@/shared/types/form'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { DataTable } from '@/shared/ui/DataTable'
import {
  createWorkRequest,
  updateWorkRequest,
  deleteWorkRequest,
  getWorkRequest,
  getWorkRequestOptions,
  getRelatedPlans,
  type RelatedPlan,
  type WorkRequest,
  type WorkRequestOptions,
  type WorkRequestPayload,
} from './workRequest.api'
import { toWorkRequestDraft } from './approvalDraft'
const empty: WorkRequestPayload = {
  documentNo: '',
  title: '',
  equipmentId: '',
  occurredDate: '',
  content: '',
  priorityCode: null,
  attachmentId: null,
  note: null,
}
function toForm(row: WorkRequest): WorkRequestPayload {
  return {
    documentNo: row.documentNo,
    title: row.title,
    equipmentId: row.equipmentId,
    occurredDate: dateInput(row.occurredDate),
    content: row.content,
    priorityCode: row.priorityCode,
    attachmentId: row.attachmentId,
    note: row.note,
  }
}

export function WorkRequestFormPage({ mode }: { mode: FormMode }) {
  const id = useParams().workRequestId
  return <Editor key={`${mode}:${id ?? ''}`} mode={mode} id={id} />
}
function Editor({ mode, id }: { mode: FormMode; id?: string }) {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()

  const [record, setRecord] = useState<WorkRequest | null>(null)
  const [form, setForm] = useState(empty)
  const [baseline, setBaseline] = useState(JSON.stringify(empty))
  const [options, setOptions] = useState<WorkRequestOptions>({
    equipment: [],
    siteId: null,
    deptId: null,
  })
  const [plans, setPlans] = useState<RelatedPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plansError, setPlansError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  useEffect(() => {
    let active = true
    Promise.all([
      getWorkRequestOptions(),
      mode !== 'create' && id ? getWorkRequest(id) : Promise.resolve(null),
    ])
      .then(([choices, row]) => {
        if (!active) return
        setOptions(choices)
        if (row) {
          setRecord(row)
          setForm(toForm(row))
          setBaseline(JSON.stringify(toForm(row)))
        }
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, mode])
  const canReadPlans = hasPermission('WRKORD:read')
  useEffect(() => {
    if (mode === 'create' || !id || !canReadPlans) return
    let active = true
    getRelatedPlans(id)
      .then((rows) => active && setPlans(rows))
      .catch((e) => active && setPlansError(toMessage(e)))
    return () => {
      active = false
    }
  }, [id, mode, canReadPlans])
  if (
    !hasPermission(
      mode === 'create'
        ? 'WRKREQ:create'
        : mode === 'edit'
          ? 'WRKREQ:update'
          : 'WRKREQ:read',
    )
  )
    return <Navigate to="/work-request" replace />
  const isNew = mode === 'create' && !record
  const owner = record?.createdBy === user?.userId
  const readOnly = isNew
    ? !hasPermission('WRKREQ:create')
    : !(owner && record?.status === 'D' && hasPermission('WRKREQ:update'))
  const blocked = loading || saving || attachmentBusy || !ready
  const disabled = readOnly || blocked
  const update = (key: keyof WorkRequestPayload, value: string) =>
    setForm((row) => ({ ...row, [key]: value }))
  const save = async (submit: boolean) => {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        occurredDate: dateValue(form.occurredDate),
      }
      const saved = isNew
        ? await createWorkRequest(payload)
        : await updateWorkRequest(record!.workRequestId, payload)
      setRecord(saved)
      setForm(toForm(saved))
      setBaseline(JSON.stringify(toForm(saved)))
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: toWorkRequestDraft(saved) },
        })
      else if (isNew)
        navigate(
          `/work-request/${encodeURIComponent(saved.workRequestId)}`,
          {
            replace: true,
          },
        )
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (
      !record ||
      !owner ||
      record.status !== 'D' ||
      !hasPermission('WRKREQ:delete') ||
      blocked ||
      !window.confirm('이 초안 의뢰서를 삭제하시겠습니까?')
    )
      return
    setSaving(true)
    setError(null)
    try {
      await deleteWorkRequest(record.workRequestId)
      navigate('/work-request')
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  return (
    <form
      ref={formRef}
      data-readonly={readOnly}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          작업의뢰서 {record && <StatusBadge status={record.status} />}
        </h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving || attachmentBusy}
            onClick={() => {
              if (confirmLeave()) navigate('/work-request')
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!record || blocked}
            onClick={() =>
              printDocument({
                title: '작업의뢰서',
                contentJson: toWorkRequestDraft({
                  ...record!,
                  ...form,
                  occurredDate: dateValue(form.occurredDate),
                }).contentJson,
              })
            }
          >
            인쇄
          </Button>
          {record?.status === 'D' &&
            owner &&
            hasPermission('WRKREQ:delete') && (
              <Button
                className="sm:ml-2"
                type="button"
                variant="danger"
                disabled={blocked}
                onClick={() => void remove()}
              >
                삭제
              </Button>
            )}
          {!readOnly && (
            <Button variant="secondary" type="submit" disabled={blocked}>
              임시저장
            </Button>
          )}
          {!readOnly && (
            <Button
              type="button"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              상신
            </Button>
          )}
        </div>
      </div>
      <DocumentIdField
        value={record?.workRequestId}
        documentNo={form.documentNo}
        onDocumentNoChange={(value) => update('documentNo', value)}
        disabled={disabled}
        readOnly={readOnly}
      />
      {loading && <p className="text-xs text-slate-500">불러오는 중…</p>}
      {error && (
        <div role="alert" className="text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="의뢰명" required>
          <Input
            required
            maxLength={200}
            value={form.title}
            disabled={disabled}
            onChange={(e) => update('title', e.target.value)}
          />
        </Field>
        <Field label="대상 설비" required>
          <Select
            required
            disabled={disabled}
            value={form.equipmentId}
            onChange={(e) => update('equipmentId', e.target.value)}
          >
            <option value="">선택</option>

            {options.equipment.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label} ({e.value})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="발생일" required>
          <Input
            type="date"
            required
            value={form.occurredDate}
            disabled={disabled}
            onChange={(e) => update('occurredDate', e.target.value)}
          />
        </Field>
        <Field label="긴급도">
          <Select
            value={form.priorityCode ?? ''}
            disabled={disabled}
            onChange={(e) => update('priorityCode', e.target.value)}
          >
            <option value="">선택</option>

            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="의뢰자">
          <Input
            disabled
            value={record?.requesterId ?? user?.userId ?? ''}
          />
        </Field>
        <Field label="사업장">
          <Input
            disabled
            value={(record ? record.siteId : options.siteId) ?? ''}
          />
        </Field>
        <Field label="부서">
          <Input
            disabled
            value={(record ? record.deptId : options.deptId) ?? ''}
          />
        </Field>
      </div>
      <Field label="고장·이상 내용" required>
        <Textarea
          required
          rows={5}
          value={form.content}
          disabled={disabled}
          onChange={(e) => update('content', e.target.value)}
        />
      </Field>
      <Field label="비고">
        <Textarea
          rows={2}
          value={form.note ?? ''}
          disabled={disabled}
          onChange={(e) => update('note', e.target.value)}
        />
      </Field>
      <AttachmentManager
        attachmentId={form.attachmentId}
        refModule="WRKREQ"
        refId={record?.workRequestId ?? null}
        disabled={disabled}
        onBusyChange={setAttachmentBusy}
        onError={setError}
        onAttachmentIdChange={(attachmentId) =>
          setForm((row) => ({ ...row, attachmentId }))
        }
      />
      {record && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between">
            <h2 className="text-base font-semibold">
              연결 작업계획{' '}
              {hasPermission('WRKORD:read') && `(${plans.length}건)`}
            </h2>
            {record.status === 'C' && hasPermission('WRKORD:create') && (
              <Button
                type="button"
                variant="secondary"
                disabled={blocked}
                onClick={() =>
                  navigate(
                    `/work-order/new?refModule=WRKREQ&refId=${encodeURIComponent(record.workRequestId)}`,
                  )
                }
              >
                작업계획 작성
              </Button>
            )}
          </div>
          {plansError && (
            <p className="text-xs text-red-700">{plansError}</p>
          )}
          {hasPermission('WRKORD:read') ? (
            <DataTable<RelatedPlan>
              rows={plans}
              gridTemplateColumns="120px 1fr 110px 80px"
              emptyText="연결된 작업계획이 없습니다."
              columns={[
                {
                  key: 'documentNo',
                  label: '관리번호',
                  render: (p) => p.documentNo,
                },
                {
                  key: 'title',
                  label: '작업명',
                  render: (p) => (
                    <Link
                      className="text-blue-700 underline"
                      to={`/work-order/${encodeURIComponent(p.workOrderId)}`}
                      onClick={(e) => {
                        if (!confirmLeave()) e.preventDefault()
                      }}
                    >
                      {p.title}
                    </Link>
                  ),
                },
                {
                  key: 'workDate',
                  label: '작업일',
                  render: (p) => dateInput(p.workDate),
                },
                {
                  key: 'status',
                  label: '상태',
                  render: (p) => <StatusBadge status={p.status} />,
                },
              ]}
            />
          ) : (
            <p className="text-xs text-slate-500">
              작업계획 조회 권한이 필요합니다.
            </p>
          )}
        </section>
      )}
      {record && <DocumentAudit record={record} />}
    </form>
  )
}
