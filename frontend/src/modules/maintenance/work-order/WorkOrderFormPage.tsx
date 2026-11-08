import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import {
  getWorkRequest,
  type WorkRequest,
} from '@/modules/maintenance/work-request'
import { AttachmentManager } from '@/modules/attachments'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import type { FormMode } from '@/shared/types/form'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/Textarea'
import {
  createWorkOrder,
  deleteWorkOrder,
  getWorkOrder,
  getWorkOrderOptions,
  updateWorkOrder,
  type OrderKind,
  type WorkOrder,
  type WorkOrderOptions,
} from './workOrder.api'
import {
  amount,
  emptyForm,
  kindName,
  toForm,
  toPayload,
  totals,
  type WorkOrderForm,
} from './workOrderForm'
import { WorkOrderDetails } from './WorkOrderDetails'
import { toWorkOrderDraft } from './approvalDraft'

async function loadReference(
  refModule: string,
  refId: string,
): Promise<WorkRequest | WorkOrder> {
  if (refModule === 'work_request') return getWorkRequest(refId)
  if (refModule === 'work_order') return getWorkOrder(refId)
  throw new Error('지원하지 않는 참조 모듈입니다.')
}
function copiedForm(
  current: WorkOrderForm,
  source: WorkRequest | WorkOrder,
  refModule: string,
  refId: string,
): WorkOrderForm {
  if ('workRequestId' in source) {
    if (source.status !== 'C')
      throw new Error('승인완료 의뢰서만 참조할 수 있습니다.')
    return {
      ...current,
      orderKind: 'PLAN',
      refModule,
      refId,
      documentNo: '',
      workDate: '',
      title: source.title,
      equipmentId: source.equipmentId,
      content: source.content,
      note: source.note ?? '',
      laborItems: [],
      materials: [],
      costItems: [],
    }
  }
  if (source.orderKind !== 'PLAN')
    throw new Error('작업계획만 참조할 수 있습니다.')
  const copied = toForm(source)
  return {
    ...current,
    orderKind: 'ACTUAL',
    refModule,
    refId,
    documentNo: '',
    workDate: '',
    equipmentId: copied.equipmentId,
    typeCode: copied.typeCode,
    content: copied.content,
    note: copied.note,
    laborItems: copied.laborItems,
    materials: copied.materials,
    costItems: copied.costItems,
  }
}

export function WorkOrderFormPage({ mode }: { mode: FormMode }) {
  const id = useParams().workOrderId
  const [params] = useSearchParams()
  const initialModule = mode === 'create' ? (params.get('refModule') ?? '') : ''
  const initialId = mode === 'create' ? (params.get('refId') ?? '') : ''
  return (
    <WorkOrderEditor
      key={`${mode}:${id ?? ''}:${initialModule}:${initialId}`}
      mode={mode}
      id={id}
      initialModule={initialModule}
      initialId={initialId}
    />
  )
}
function WorkOrderEditor({
  mode,
  id,
  initialModule,
  initialId,
}: {
  mode: FormMode
  id?: string
  initialModule: string
  initialId: string
}) {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [requestKey] = useState(() => crypto.randomUUID())
  const [document, setDocument] = useState<WorkOrder | null>(null)
  const [form, setForm] = useState<WorkOrderForm>(emptyForm)
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm))
  const [options, setOptions] = useState<WorkOrderOptions>({
    equipment: [],
    types: [],
    plans: [],
    requests: [],
    siteId: null,
    deptId: null,
  })
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [copying, setCopying] = useState(false)
  const [referenceBusy, setReferenceBusy] = useState(false)
  const [reference, setReference] = useState<{
    refModule: string
    refId: string
    document: WorkRequest | WorkOrder
  } | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  useEffect(() => {
    let active = true
    Promise.all([
      getWorkOrderOptions(),
      mode !== 'create' && id ? getWorkOrder(id) : Promise.resolve(null),
      initialModule || initialId
        ? loadReference(initialModule, initialId)
        : Promise.resolve(null),
    ])
      .then(([choices, row, source]) => {
        if (!active) return
        setOptions(choices)
        if (row) {
          setDocument(row)
          setForm(toForm(row))
          setBaseline(JSON.stringify(toForm(row)))
        }
        if (source) {
          const copied = copiedForm(emptyForm, source, initialModule, initialId)
          setForm(copied)
        }
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [mode, id, initialModule, initialId])
  useEffect(() => {
    if (!form.refModule || !form.refId) return
    let active = true
    loadReference(form.refModule, form.refId)
      .then((document) => {
        if (active) {
          setReference({
            refModule: form.refModule,
            refId: form.refId,
            document,
          })
          setReferenceError(null)
        }
      })
      .catch((e) => active && setReferenceError(toMessage(e)))
    return () => {
      active = false
    }
  }, [form.refModule, form.refId])
  const required =
    mode === 'create'
      ? 'work_order:create'
      : mode === 'edit'
        ? 'work_order:update'
        : 'work_order:read'
  if (!hasPermission(required)) return <Navigate to="/work-order" replace />
  const isNew = mode === 'create' && !document
  const owner = document?.createdBy === user?.userId
  const readOnly = isNew
    ? !hasPermission('work_order:create')
    : !(owner && document?.status === 'D' && hasPermission('work_order:update'))
  const blocked =
    loading || saving || copying || attachmentBusy || referenceBusy || !ready
  const disabled = readOnly || blocked
  const referenceDocument =
    reference?.refModule === form.refModule && reference.refId === form.refId
      ? reference.document
      : null
  const referenceChoices =
    form.orderKind === 'PLAN'
      ? (options.requests ?? []).map((r) => ({
          value: r.workRequestId,
          label: `${r.workRequestId} / ${r.documentNo ? `${r.documentNo} / ` : ''}${r.title}`,
        }))
      : options.plans.map((p) => ({
          value: p.workOrderId,
          label: `${p.workOrderId} / ${p.documentNo ? `${p.documentNo} / ` : ''}${p.title}`,
        }))
  const referenceLabel = form.orderKind === 'PLAN' ? '참조 의뢰서' : '참조 계획'
  const labels = {
    equipment: options.equipment.find((e) => e.value === form.equipmentId)
      ?.label,
    plan: referenceDocument?.title,
  }
  const update = (
    key: Exclude<keyof WorkOrderForm, 'laborItems' | 'materials' | 'costItems'>,
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'orderKind' ? { refModule: '', refId: '' } : {}),
    }))

  const copyReference = async (refId: string) => {
    if (disabled) return
    if (!refId) {
      setForm((row) => ({ ...row, refModule: '', refId: '' }))
      return
    }
    if (
      (form.content ||
        form.laborItems.length ||
        form.materials.length ||
        form.costItems.length) &&
      !window.confirm(
        '선택한 원본으로 작업 내용과 상세를 대체하고 관리번호·작업일을 비우시겠습니까?',
      )
    )
      return
    setCopying(true)
    setError(null)
    try {
      const refModule =
        form.orderKind === 'PLAN' ? 'work_request' : 'work_order'
      const source = await loadReference(refModule, refId)
      const copied = copiedForm(form, source, refModule, refId)
      setForm(copied)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setCopying(false)
    }
  }
  const save = async (submit: boolean) => {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError(null)
    try {
      const saved = isNew
        ? await createWorkOrder(requestKey, form.orderKind, toPayload(form))
        : await updateWorkOrder(document!.workOrderId, toPayload(form))
      setDocument(saved)
      setForm(toForm(saved))
      setBaseline(JSON.stringify(toForm(saved)))
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: toWorkOrderDraft(saved, labels) },
        })
      else if (isNew)
        navigate(`/work-order/${encodeURIComponent(saved.workOrderId)}`, {
          replace: true,
        })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (
      !document ||
      !owner ||
      document.status !== 'D' ||
      !hasPermission('work_order:delete') ||
      blocked ||
      !window.confirm('이 초안 문서를 삭제하시겠습니까?')
    )
      return
    setSaving(true)
    setError(null)
    try {
      await deleteWorkOrder(document.workOrderId)
      navigate('/work-order')
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  const print = () => {
    if (!document) return
    const payload = toPayload(form)
    const printable: WorkOrder = {
      ...document,
      ...payload,
      ...totals(form),
      materials: payload.materials.map((r, i) => ({
        ...r,
        amount: amount(form.materials[i].quantity, form.materials[i].unitPrice),
      })),
    }
    printDocument({
      title: `작업 오더 ${kindName(form.orderKind)}`,
      contentJson: toWorkOrderDraft(printable, labels).contentJson,
    })
  }
  return (
    <form
      ref={formRef}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-4 border border-slate-200 bg-white p-3"
    >
      <DocumentIdField value={document?.workOrderId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          작업 오더 {document && <StatusBadge status={document.status} />}
        </h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!document || blocked}
            onClick={print}
          >
            인쇄
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving || copying || attachmentBusy || referenceBusy}
            onClick={() => {
              if (confirmLeave()) navigate('/work-order')
            }}
          >
            목록
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={blocked}>
              저장
            </Button>
          )}
          {document?.status === 'D' &&
            owner &&
            hasPermission('work_order:delete') && (
              <Button
                type="button"
                variant="danger"
                disabled={blocked}
                onClick={() => void remove()}
              >
                삭제
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
      {loading && <p className="text-xs text-slate-500">조회 중...</p>}
      {error && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="계획/실적" required>
          <Select
            required
            disabled={disabled || !isNew}
            value={form.orderKind}
            onChange={(e) => update('orderKind', e.target.value as OrderKind)}
          >
            <option value="PLAN">계획</option>
            <option value="ACTUAL">실적</option>
          </Select>
        </Field>
        <Field label="관리번호">
          <Input
            maxLength={50}
            value={form.documentNo}
            disabled={disabled}
            onChange={(e) => update('documentNo', e.target.value)}
          />
        </Field>
        <Field label="작업명" required>
          <Input
            maxLength={200}
            required
            value={form.title}
            disabled={disabled}
            onChange={(e) => update('title', e.target.value)}
          />
        </Field>
        <Field label="대상 설비" required>
          <Select
            required
            value={form.equipmentId}
            disabled={disabled}
            onChange={(e) => update('equipmentId', e.target.value)}
          >
            <option value="">선택</option>
            {form.equipmentId &&
              !options.equipment.some((e) => e.value === form.equipmentId) && (
                <option value={form.equipmentId}>
                  {form.equipmentId} (기존 값)
                </option>
              )}
            {options.equipment.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label} ({e.value})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="작업일" required>
          <Input
            type="date"
            required
            value={form.workDate}
            disabled={disabled}
            onChange={(e) => update('workDate', e.target.value)}
          />
        </Field>
        <Field label="작업유형">
          <Select
            value={form.typeCode}
            disabled={disabled}
            onChange={(e) => update('typeCode', e.target.value)}
          >
            <option value="">선택</option>
            {form.typeCode &&
              !options.types.some((e) => e.value === form.typeCode) && (
                <option value={form.typeCode}>{form.typeCode} (기존 값)</option>
              )}
            {options.types.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={referenceLabel}>
          <Select
            value={form.refId}
            disabled={disabled}
            onChange={(e) => void copyReference(e.target.value)}
          >
            <option value="">참조 없음</option>
            {form.refId &&
              !referenceChoices.some((c) => c.value === form.refId) && (
                <option value={form.refId}>{form.refId} (기존 참조)</option>
              )}
            {referenceChoices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="사업장">
          <Input
            disabled
            value={(document ? document.siteId : options.siteId) || ''}
          />
        </Field>
        <Field label="부서">
          <Input
            disabled
            value={(document ? document.deptId : options.deptId) || ''}
          />
        </Field>
      </div>
      {form.refModule && form.refId && (
        <section className="space-y-2 border border-slate-200 p-3">
          <Link
            className="inline-block text-xs text-blue-700 underline"
            to={`/${form.refModule.replaceAll('_', '-')}/${encodeURIComponent(form.refId)}`}
            onClick={(e) => {
              if (blocked || !confirmLeave()) e.preventDefault()
            }}
          >
            {referenceLabel} 조회
          </Link>
          {referenceError && (
            <p className="text-xs text-slate-500">
              참조 문서를 조회할 수 없습니다.
            </p>
          )}
          {referenceDocument && (
            <AttachmentManager
              key={`${form.refModule}:${form.refId}`}
              attachmentId={referenceDocument.attachmentId}
              refModule={form.refModule}
              refId={form.refId}
              disabled
              onBusyChange={setReferenceBusy}
              onAttachmentIdChange={() => undefined}
              onError={setReferenceError}
            />
          )}
        </section>
      )}
      <Field label="작업 내용">
        <Textarea
          rows={4}
          value={form.content}
          disabled={disabled}
          onChange={(e) => update('content', e.target.value)}
        />
      </Field>
      <WorkOrderDetails
        form={form}
        setForm={setForm}
        readOnly={readOnly}
        disabled={disabled}
      />
      <Field label="비고">
        <Textarea
          rows={2}
          value={form.note}
          disabled={disabled}
          onChange={(e) => update('note', e.target.value)}
        />
      </Field>
      <AttachmentManager
        attachmentId={form.attachmentId}
        refModule="work_order"
        refId={document?.workOrderId ?? null}
        disabled={disabled}
        onBusyChange={setAttachmentBusy}
        onError={setError}
        onAttachmentIdChange={(attachmentId) =>
          setForm((current) => ({ ...current, attachmentId }))
        }
      />
      {document && (
        <p className="text-xs text-slate-500">
          등록자: {document.createdBy} / 등록일시: {document.createdAt} /
          수정자: {document.updatedBy || '-'} / 수정일시:{' '}
          {document.updatedAt || '-'}
        </p>
      )}
    </form>
  )
}
