import { dateInput, dateValue, todayDateInput } from '@/shared/lib/format'
import { useMetadata } from '@/shared/metadata/metadata'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { printPurchaseOrder } from './purchase-order.print'
import { PurchaseOrderItems } from './PurchaseOrderItems'
import { LinkedPurchaseOrders } from './LinkedPurchaseOrders'
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
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
  purchaseOrderApi,
  purchaseOrderBase as base,
  purchaseOrderLabel,
  type PurchaseOrderRecord,
  type PurchaseOrderItem,
  type PurchaseOrderOptions,
} from './purchase-order.api'
import { purchaseOrderDraft } from './purchase-order.form'
import { previewAmount } from './purchase-order.calculation'

const emptyOptions: PurchaseOrderOptions = {
  materials: [],
  sites: [],
  departments: [],
  users: [],
  types: [],
  requests: [],
  vendors: [],
}
export function PurchaseOrderForm() {
  const { id } = useParams()
  return <PurchaseOrderEditor key={`order:${id ?? ''}`} id={id} />
}
function PurchaseOrderEditor({ id }: { id?: string }) {
  const { numericPrecision } = useMetadata()
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'PURORD'
  const [record, setRecord] = useState<PurchaseOrderRecord | null>(null),
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
    vendorId: '',
    toSiteId: user?.siteId ?? '',
    deliveryLocation: '',
  })
  const [items, setItems] = useState<PurchaseOrderItem[]>([]),
    [refId, setRefId] = useState(''),
    [attachmentId, setAttachmentId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [baseline, setBaseline] = useState('')
  const state = JSON.stringify({ form, items, refId, attachmentId }),
    initialState = useRef(state),
    confirmLeave = useUnsavedChanges(ready && baseline !== state),
    formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let active = true
    Promise.all([
      purchaseOrderApi.options(),
      id ? purchaseOrderApi.get(id) : Promise.resolve(null),
    ])
      .then(([opt, row]) => {
        if (!active) return
        setOptions(opt)
        if (row) {
          const loaded = {
            documentNo: row.documentNo,
            title: row.title,
            date: dateInput(row.orderDate),
            dueDate: dateInput(row.expectedDeliveryDate),
            siteId: row.siteId ?? '',
            deptId: row.deptId ?? '',
            requesterId: row.requesterId,
            typeCode: row.typeCode ?? '',
            content: row.content ?? '',
            note: row.note ?? '',
            vendorId: row.vendorId ?? '',
            toSiteId: row.toSiteId,
            deliveryLocation: row.deliveryLocation ?? '',
          }
          setForm(loaded)
          setItems(row.items)
          setRefId(row.refId ?? '')
          setAttachmentId(row.attachmentId)
          setRecord(row)
          setBaseline(
            JSON.stringify({
              form: loaded,
              items: row.items,
              refId: row.refId ?? '',
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
  async function chooseRequest(value: string) {
    if (disabled) return
    // 참조 해제는 입력한 내용을 유지한다. 재선택/다시 불러오기는 확인 후 한 번 복사한다.
    if (!value) {
      setRefId('')
      return
    }
    if (
      (items.length ||
        form.title ||
        form.content ||
        form.note ||
        form.dueDate) &&
      !window.confirm(
        '구매요청의 제목·납기·본문·비고·품목으로 현재 입력값을 덮어쓰시겠습니까?',
      )
    )
      return
    setSaving(true)
    setError('')
    try {
      const source = await purchaseOrderApi.preview(value)
      setRefId(value)
      setForm((f) => ({
        ...f,
        title: source.title,
        content: source.content ?? '',
        note: source.note ?? '',
        dueDate: dateInput(source.expectedDeliveryDate),
      }))
      setItems(source.items)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function save(submit: boolean) {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const { date, dueDate, ...rest } = form
      const payload = {
        ...rest,
        orderDate: dateValue(date),
        expectedDeliveryDate: dateValue(dueDate) || null,
        attachmentId,
        refModule: refId ? 'PURREQ' : null,
        refId: refId || null,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          spec: i.spec,
          ...{ unitPrice: i.unitPrice || null },
          note: i.note,
        })),
      }
      const row = await purchaseOrderApi.save(id ?? '', payload, !id)
      setRecord(row)
      setBaseline(state)
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: purchaseOrderDraft(row) },
        })
      else if (!id) navigate(`${base}/${row.orderId}`, { replace: true })
      else {
        setItems(row.items)
        setBaseline(
          JSON.stringify({ form, items: row.items, refId, attachmentId }),
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
      await purchaseOrderApi.remove(id)
      navigate(base)
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  if (!hasPermission(`${module}:${id ? 'read' : 'create'}`))
    return <Navigate to={base} replace />
  const total = items
    .reduce(
      (sum, i) =>
        sum + BigInt(previewAmount(i.quantity, i.unitPrice) || '0'),
      0n,
    )
    .toString()
  const selectedVendor =
    options.vendors.find((v) => v.vendorId === form.vendorId) ??
    (record?.vendorId === form.vendorId ? record.vendor : null)
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
          {purchaseOrderLabel}{' '}
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
              printPurchaseOrder({
                precision: numericPrecision,
                record,
                form,
                items,
                refId,
                vendorName: selectedVendor?.name ?? '',
                total,
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
        value={record?.orderId}
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
            ['title', '발주명'],
            ['date', '발주일'],
            ['dueDate', '납기일'],
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
        <Field label="입고 예정 사업장" required>
          <Select
            required
            value={form.toSiteId}
            disabled={disabled}
            onChange={(e) => change('toSiteId', e.target.value)}
          >
            <option value="">선택</option>
            {options.sites.map((site) => (
              <option key={site.value} value={site.value}>
                {site.label} ({site.value})
              </option>
            ))}
          </Select>
        </Field>
        {
          <Field label="거래처" required>
            <Select
              required
              value={form.vendorId}
              disabled={disabled}
              onChange={(e) => change('vendorId', e.target.value)}
            >
              <option value="">거래처를 선택하십시오</option>

              {options.vendors.map((v) => (
                <option key={v.vendorId} value={v.vendorId}>
                  {v.vendorId} / {v.name}
                </option>
              ))}
            </Select>
          </Field>
        }
        {
          <>
            {(
              [
                ['name', '공급처'],
                ['registrationNumber', '사업자번호'],
                ['contactName', '공급처 담당자'],
                ['phoneNumber', '연락처'],
                ['email', '이메일'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input value={selectedVendor?.[key] ?? ''} readOnly />
              </Field>
            ))}
            <Field label="납품 장소">
              <Input
                value={form.deliveryLocation}
                disabled={disabled}
                maxLength={300}
                onChange={(e) =>
                  change('deliveryLocation', e.target.value)
                }
              />
            </Field>
          </>
        }
      </div>
      <section className="space-y-2 rounded-md border border-slate-200 p-3">
        <Field label="참조 구매요청">
          <Select
            aria-label="참조 구매요청"
            value={refId}
            disabled={disabled}
            onChange={(e) => void chooseRequest(e.target.value)}
          >
            <option value="">참조 없음 (단독 발주)</option>

            {options.requests.map((r) => (
              <option key={r.requestId} value={r.requestId}>
                {r.requestId} / {r.documentNo ? `${r.documentNo} / ` : ''}
                {r.title}
              </option>
            ))}
          </Select>
        </Field>
        {refId && (
          <div className="flex items-center gap-3 text-xs">
            <Link
              className="text-blue-700 underline"
              to={`/purchase-request/${encodeURIComponent(refId)}`}
            >
              원 요청 조회
            </Link>
            {!readOnly && (
              <Button
                type="button"
                variant="secondary"
                disabled={blocked}
                onClick={() => void chooseRequest(refId)}
              >
                요청 다시 불러오기
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-slate-500">
          요청은 초기값으로만 복사하며 이후 자유롭게 수정할 수 있습니다.
          참조를 해제해도 입력값은 유지됩니다.
        </p>
        {refId && <LinkedPurchaseOrders requestId={refId} />}
      </section>
      <PurchaseOrderItems
        items={items}
        setItems={setItems}
        options={options}
        disabled={disabled}
        readOnly={readOnly}
        blocked={blocked}
        total={total}
      />
      <Field label={'발주 내용'}>
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
      {record && <DocumentAudit record={record} />}
    </form>
  )
}
