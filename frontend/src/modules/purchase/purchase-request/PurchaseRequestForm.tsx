import { dateInput, dateValue, todayDateInput } from '@/shared/lib/format'
import { useMetadata } from '@/shared/metadata/metadata'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { printPurchaseRequest } from './purchase-request.print'
import { PurchaseRequestItems } from './PurchaseRequestItems'
import { LinkedPurchaseOrders } from '../purchase-order/LinkedPurchaseOrders'
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  purchaseRequestApi,
  purchaseRequestBase as base,
  purchaseRequestLabel,
  type PurchaseRequestRecord,
  type PurchaseRequestItem,
  type PurchaseRequestOptions,
} from './purchase-request.api'
import { purchaseRequestDraft } from './purchase-request.form'

const emptyOptions: PurchaseRequestOptions = {
  materials: [],
  sites: [],
  departments: [],
  users: [],
  types: [],
}
export function PurchaseRequestForm() {
  const { id } = useParams()
  return <PurchaseRequestEditor key={`request:${id ?? ''}`} id={id} />
}
function PurchaseRequestEditor({ id }: { id?: string }) {
  const { numericPrecision } = useMetadata()
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'PURREQ'
  const [record, setRecord] = useState<PurchaseRequestRecord | null>(null),
    [options, setOptions] = useState(emptyOptions)
  const [form, setForm] = useState({
    documentNo: '',
    title: '',
    date: todayDateInput(),
    dueDate: '',
    siteId: user?.siteId ?? '',
    deptId: user?.deptId ?? '',
    requesterId: user?.userId ?? '',
    typeCode: '',
    content: '',
    note: '',
  })
  const [items, setItems] = useState<PurchaseRequestItem[]>([]),
    [attachmentId, setAttachmentId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [baseline, setBaseline] = useState('')
  const state = JSON.stringify({ form, items, attachmentId }),
    initialState = useRef(state),
    confirmLeave = useUnsavedChanges(ready && baseline !== state),
    formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let active = true
    Promise.all([
      purchaseRequestApi.options(),
      id ? purchaseRequestApi.get(id) : Promise.resolve(null),
    ])
      .then(([opt, row]) => {
        if (!active) return
        setOptions(opt)
        if (row) {
          const loaded = {
            documentNo: row.documentNo,
            title: row.title,
            date: dateInput(row.requestDate),
            dueDate: dateInput(row.requiredDate),
            siteId: row.siteId ?? '',
            deptId: row.deptId ?? '',
            requesterId: row.requesterId,
            typeCode: row.typeCode ?? '',
            content: row.content ?? '',
            note: row.note ?? '',
          }
          setForm(loaded)
          setItems(row.items)
          setAttachmentId(row.attachmentId)
          setRecord(row)
          setBaseline(
            JSON.stringify({
              form: loaded,
              items: row.items,
              attachmentId: row.attachmentId,
            }),
          )
        } else setBaseline(initialState.current)
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [id]) // Initial form is scoped to the keyed editor.
  const readOnly = id
      ? !(
          record?.status === 'D' &&
          record.createdBy === user?.userId &&
          hasPermission(`${module}:update`)
        )
      : !hasPermission(`${module}:create`),
    blocked = !ready || busy || saving,
    disabled = readOnly || blocked
  const change = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  async function save(submit: boolean) {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const { date, dueDate, ...rest } = form
      const payload = {
        ...rest,
        requestDate: dateValue(date),
        requiredDate: dateValue(dueDate) || null,
        attachmentId,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          note: i.note,
        })),
      }
      const row = await purchaseRequestApi.save(id ?? '', payload, !id)
      setRecord(row)
      setBaseline(state)
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: purchaseRequestDraft(row) },
        })
      else if (!id) navigate(`${base}/${row.requestId}`, { replace: true })
      else {
        setItems(row.items)
        setBaseline(
          JSON.stringify({ form, items: row.items, attachmentId }),
        )
      }
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (
      !id ||
      blocked ||
      readOnly ||
      !window.confirm('초안 문서를 삭제하시겠습니까?')
    )
      return
    setSaving(true)
    try {
      await purchaseRequestApi.remove(id)
      navigate(base)
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  if (!hasPermission(`${module}:${id ? 'read' : 'create'}`))
    return <Navigate to={base} replace />
  return (
    <form
      ref={formRef}
      data-readonly={readOnly}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-lg font-semibold">
          {purchaseRequestLabel}{' '}
          {record && <StatusBadge status={record.status} />}
        </h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || saving}
            onClick={() => {
              if (confirmLeave()) navigate(base)
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!record || blocked}
            onClick={() =>
              printPurchaseRequest({
                record,
                form,
                items,
                precision: numericPrecision,
              })
            }
          >
            인쇄
          </Button>
          {id && !readOnly && hasPermission(`${module}:delete`) && (
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
        value={record?.requestId}
        documentNo={form.documentNo}
        onDocumentNoChange={(value) => change('documentNo', value)}
        disabled={disabled}
        readOnly={readOnly}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && <p>불러오는 중…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ['title', '요청명'],
            ['date', '요청일'],
            ['dueDate', '필요일'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label} required={key === 'title'}>
            <Input
              type={key === 'date' || key === 'dueDate' ? 'date' : 'text'}
              maxLength={key === 'title' ? 200 : 50}
              required={key === 'title'}
              value={form[key]}
              disabled={disabled}
              onChange={(e) => change(key, e.target.value)}
            />
          </Field>
        ))}
        {(
          [
            ['siteId', '사업장', options.sites],
            ['deptId', '부서', options.departments],
            ['requesterId', '담당자', options.users],
            ['typeCode', '유형', options.types],
          ] as const
        ).map(([key, label, choices]) => (
          <Field key={key} label={label}>
            <Select
              value={form[key]}
              disabled={disabled || key === 'siteId' || key === 'deptId'}
              onChange={(e) => change(key, e.target.value)}
            >
              <option value="">선택</option>

              {choices.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>

      <PurchaseRequestItems
        items={items}
        setItems={setItems}
        options={options}
        disabled={disabled}
        readOnly={readOnly}
        blocked={blocked}
      />
      <Field label={'구매 사유'}>
        <Textarea
          rows={3}
          disabled={disabled}
          value={form.content}
          onChange={(e) => change('content', e.target.value)}
        />
      </Field>
      <Field label="비고">
        <Textarea
          disabled={disabled}
          value={form.note}
          onChange={(e) => change('note', e.target.value)}
        />
      </Field>
      <AttachmentManager
        attachmentId={attachmentId}
        refModule={module}
        refId={id ?? null}
        disabled={disabled}
        onBusyChange={setBusy}
        onError={setError}
        onAttachmentIdChange={setAttachmentId}
      />
      {record && <LinkedPurchaseOrders requestId={record.requestId} />}
      {record && <DocumentAudit record={record} />}
    </form>
  )
}
