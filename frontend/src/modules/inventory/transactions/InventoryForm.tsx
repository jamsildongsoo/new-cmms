import {
  inventoryMenus,
  inventoryMenu,
  type InventoryMenu,
} from './inventory.navigation'
import { useMetadata } from '@/shared/metadata/metadata'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { printInventory } from './inventory.print'
import { InventoryItems } from './InventoryItems'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { DocumentAudit } from '@/shared/ui/DocumentAudit'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { Field } from '@/shared/ui/Field'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import {
  formatDateTime,
  dateInput,
  dateValue,
  todayDateInput,
} from '@/shared/lib/format'

import {
  type InventoryType,
  type InventoryKind,
} from '../inventory.constant'
import {
  inventoryApi,
  type InventoryRecord,
  type InventoryOptions,
  type InventoryItem,
  type PurchaseReceiptSource,
} from './inventory.api'

const emptyOptions: InventoryOptions = {
  materials: [],
  sites: [],
  warehouses: [],
  orders: [],
  periods: [],
}
const base = '/inventory-document'
export function InventoryForm({ mode = 'IN' }: { mode?: InventoryMenu }) {
  const { id } = useParams()
  return <InventoryEditor key={id ?? mode} id={id} mode={mode} />
}
function InventoryEditor({
  id,
  mode,
}: {
  id?: string
  mode: InventoryMenu
}) {
  const menu = inventoryMenus[mode]
  const { inventoryVariants, inventoryStatuses, numericPrecision } =
    useMetadata()
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    formRef = useRef<HTMLFormElement>(null)
  const [record, setRecord] = useState<InventoryRecord | null>(null),
    [options, setOptions] = useState(emptyOptions),
    [source, setSource] = useState<PurchaseReceiptSource | null>(null)
  const [form, setForm] = useState({
    documentNo: '',
    title: '',
    type: menu.type as InventoryType,
    kind: menu.kind as InventoryKind | null,
    postingDate: todayDateInput(),
    siteId: user?.siteId ?? '',
    warehouseId: '',
    deptId: user?.deptId ?? '',
    toSiteId: '',
    toWarehouseId: '',
    refId: '',
    reason: '',
    note: '',
  })
  const [items, setItems] = useState<InventoryItem[]>([]),
    [attachmentId, setAttachmentId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [baseline, setBaseline] = useState('')
  const state = JSON.stringify({ form, items, attachmentId }),
    initialState = useRef(state),
    confirmLeave = useUnsavedChanges(
      ready && !record && state !== baseline,
    )
  useEffect(() => {
    let active = true
    if (
      !hasPermission('INVDOC:read') ||
      (!id && !hasPermission('INVDOC:create'))
    )
      return
    Promise.all([
      inventoryApi.options(),
      id ? inventoryApi.get(id) : Promise.resolve(null),
    ])
      .then(([o, r]) => {
        if (!active) return
        setOptions(o)
        if (r) {
          setRecord(r)
          setForm({
            documentNo: r.documentNo,
            title: r.title,
            type: r.type,
            kind: r.kind,
            postingDate: dateInput(r.postingDate),
            siteId: r.siteId,
            warehouseId: r.warehouseId,
            deptId: r.deptId ?? '',
            toSiteId: r.toSiteId ?? '',
            toWarehouseId: r.toWarehouseId ?? '',
            refId: r.refId ?? '',
            reason: r.reason ?? '',
            note: r.note ?? '',
          })
          setItems(r.items)
          setAttachmentId(r.attachmentId)
        }
        setBaseline(initialState.current)
        setReady(true)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
    return () => {
      active = false
    }
  }, [id, hasPermission])
  const readonly = !!id || !!record,
    disabled = readonly || !ready || busy || saving,
    purchaseIn = form.type === 'IN' && form.kind === 'PURCHASE',
    movingOut = form.type === 'OUT' && form.kind === 'TRANSFER'
  const period = options.periods.find(
      (p) => p.yearMonth === dateValue(form.postingDate).slice(0, 6),
    ),
    open = !!period && !period.locked
  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  async function chooseReference(value: string) {
    if (disabled) return
    if (
      items.length &&
      !window.confirm(
        '선택한 원본의 전체 품목으로 현재 입력값을 바꾸시겠습니까?',
      )
    )
      return
    if (!value) {
      set('refId', '')
      setSource(null)
      setItems([])
      return
    }
    setSaving(true)
    setError('')
    try {
      const src = await inventoryApi.purchaseOrder(value)
      setSource(src)
      setForm((f) => ({
        ...f,
        refId: value,
        title: f.title || src.title,
        siteId: src.siteId,
        warehouseId: '',
      }))
      setItems(
        src.items.map((i) => ({
          ...i,
          itemId: crypto.randomUUID(),
          amount: '0',
          note: null,
        })),
      )
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (disabled || !open || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const saved = await inventoryApi.create({
        ...form,
        type: form.type,
        kind: form.kind,
        postingDate: dateValue(form.postingDate),
        toSiteId: movingOut ? form.toSiteId : null,
        toWarehouseId: movingOut ? form.toWarehouseId || null : null,
        refId: purchaseIn ? form.refId : null,
        refModule: purchaseIn ? 'PURORD' : null,
        attachmentId,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          ...(form.type === 'ADJUST' ? { amount: i.amount } : {}),
          refItemId: i.refItemId,
          note: i.note,
        })),
      })
      setRecord(saved)
      setBaseline(state)
      navigate(`${base}/${saved.inventoryDocumentId}`, { replace: true })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function cancel() {
    if (!id || saving || !open) return
    const reason = window.prompt(
      '확정 취소 사유를 입력하십시오. 원 전표의 전기월에 반영됩니다.',
    )
    if (!reason?.trim()) return
    setSaving(true)
    setError('')
    try {
      const saved = await inventoryApi.cancel(id, reason)
      setRecord(saved)
      setItems(saved.items)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const listPath = record
    ? inventoryMenus[inventoryMenu(record)].path
    : menu.path
  const pending = record?.status === 'W'
  async function confirmReceipt() {
    if (!id || !open || saving) return
    setSaving(true)
    setError('')
    try {
      const saved = await inventoryApi.confirm(
        id,
        dateValue(form.postingDate),
      )
      setRecord(saved)
      setItems(saved.items)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  const wh = options.warehouses.filter((w) => w.siteId === form.siteId)

  if (!hasPermission(`INVDOC:${id ? 'read' : 'create'}`))
    return <p role="alert">처리 권한이 없습니다.</p>
  return (
    <form
      ref={formRef}
      onSubmit={(e) => void submit(e)}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-lg font-semibold">
          {record
            ? inventoryVariants.find(
                (v) => v.type === record.type && v.kind === record.kind,
              )?.label
            : menu.label}{' '}
          {record &&
            inventoryStatuses.find((s) => s.value === record.status)
              ?.label}
        </h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving || busy}
            onClick={() => {
              if (confirmLeave()) navigate(listPath)
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!record || saving}
            onClick={() =>
              printInventory(
                record,
                inventoryVariants,
                numericPrecision,
                inventoryStatuses,
              )
            }
          >
            인쇄
          </Button>
          {!readonly && (
            <Button type="submit" disabled={disabled || !open}>
              확정
            </Button>
          )}
          {pending && hasPermission('INVDOC:update') && (
            <Button
              type="button"
              disabled={saving || !open}
              onClick={() => void confirmReceipt()}
            >
              입고 확정
            </Button>
          )}
          {record?.status === 'C' && hasPermission('INVDOC:update') && (
            <Button
              type="button"
              variant="danger"
              disabled={saving || !open}
              onClick={() => void cancel()}
            >
              확정 취소
            </Button>
          )}
        </div>
      </div>
      <DocumentIdField
        value={record?.inventoryDocumentId}
        documentNo={form.documentNo}
        onDocumentNoChange={(v) => set('documentNo', v)}
        disabled={disabled}
        readOnly={readonly}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && <p>불러오는 중…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="전표명" required>
          <Input
            required
            maxLength={200}
            disabled={disabled}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="수불 유형" required>
          <Select
            required
            disabled={disabled}
            value={`${form.type}:${form.kind ?? ''}`}
            onChange={(e) => {
              if (
                items.length &&
                !window.confirm(
                  '유형을 변경하면 원본과 품목 입력이 초기화됩니다. 변경하시겠습니까?',
                )
              )
                return
              const v = inventoryVariants.find(
                (v) => `${v.type}:${v.kind ?? ''}` === e.target.value,
              )
              if (!v) return
              setForm((f) => ({
                ...f,
                type: v.type,
                kind: v.kind,
                refId: '',
                toSiteId: '',
                toWarehouseId: '',
              }))
              setItems([])
              setSource(null)
            }}
          >
            {inventoryVariants
              .filter((v) =>
                record
                  ? true
                  : v.type === menu.type &&
                    (mode === 'IN'
                      ? v.kind !== 'TRANSFER'
                      : v.kind === menu.kind),
              )
              .map((v) => (
                <option
                  key={`${v.type}:${v.kind}`}
                  value={`${v.type}:${v.kind ?? ''}`}
                >
                  {v.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="전기일" required>
          <Input
            type="date"
            required
            disabled={pending ? saving : disabled}
            value={form.postingDate}
            onChange={(e) => set('postingDate', e.target.value)}
          />
          <p
            className={`text-xs ${open ? 'text-green-700' : 'text-red-700'}`}
          >
            {period ? (period.locked ? '월 마감' : '개시') : '미개방 월'} ·
            마감 월은 확정·취소할 수 없습니다.
          </p>
        </Field>
        <Field
          label={form.type === 'OUT' ? '출발 사업장' : '입고/처리 사업장'}
        >
          <Select
            disabled={
              disabled || user?.accessScope !== 'COMPANY_ALL' || purchaseIn
            }
            value={form.siteId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                siteId: e.target.value,
                warehouseId: '',
              }))
            }
          >
            <option value="">선택</option>
            {options.sites.map((site) => (
              <option key={site.value} value={site.value}>
                {site.label} ({site.value})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="담당부서">
          <Input readOnly value={form.deptId} />
        </Field>
        <Field
          label={
            form.type === 'OUT'
              ? '출발 창고'
              : form.type === 'IN'
                ? '입고 창고'
                : '조정 창고'
          }
          required
        >
          <Select
            required
            disabled={disabled}
            value={form.warehouseId}
            onChange={(e) => set('warehouseId', e.target.value)}
          >
            <option value="">선택</option>
            {wh.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>
                {w.name} ({w.warehouseId})
              </option>
            ))}
          </Select>
        </Field>
        {purchaseIn && (
          <Field label="구매발주" required>
            <Select
              required
              disabled={disabled}
              value={form.refId}
              onChange={(e) => void chooseReference(e.target.value)}
            >
              <option value="">선택</option>
              {record?.refId && (
                <option value={record.refId}>{record.refId}</option>
              )}
              {options.orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>
                  {o.orderId} / {o.documentNo} / {o.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {record?.refId && (
          <Field label="원본 문서">
            <Link
              className="text-blue-700 underline"
              to={`${purchaseIn ? '/purchase-order' : base}/${encodeURIComponent(record.refId)}`}
            >
              {record.refId}
            </Link>
          </Field>
        )}
        {source && <p className="text-xs">입고 사업장: {source.siteId}</p>}
        {movingOut && (
          <>
            <Field label="수령 창고" required>
              <Select
                required
                disabled={disabled}
                value={
                  form.toWarehouseId
                    ? JSON.stringify([form.toSiteId, form.toWarehouseId])
                    : ''
                }
                onChange={(e) => {
                  const [siteId, warehouseId] = e.target.value
                    ? (JSON.parse(e.target.value) as [string, string])
                    : ['', '']
                  setForm((f) => ({
                    ...f,
                    toSiteId: siteId,
                    toWarehouseId: warehouseId,
                  }))
                }}
              >
                <option value="">선택</option>
                {options.warehouses
                  .filter(
                    (w) =>
                      w.siteId !== form.siteId ||
                      w.warehouseId !== form.warehouseId,
                  )
                  .map((w) => (
                    <option
                      key={JSON.stringify([w.siteId, w.warehouseId])}
                      value={JSON.stringify([w.siteId, w.warehouseId])}
                    >
                      {w.siteId} / {w.name} ({w.warehouseId})
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="수령 사업장">
              <Input readOnly value={form.toSiteId} />
            </Field>
          </>
        )}
      </div>
      <InventoryItems
        items={items}
        setItems={setItems}
        options={options}
        disabled={disabled}
        readonly={readonly}
        linked={purchaseIn}
        type={form.type}
        kind={form.kind}
      />
      <Field label="사유" required={form.type === 'ADJUST'}>
        <Textarea
          required={form.type === 'ADJUST'}
          disabled={disabled}
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
        />
      </Field>
      <Field label="비고">
        <Textarea
          disabled={disabled}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
        />
      </Field>
      {record?.status === 'X' && (
        <section className="text-xs space-y-1">
          <h2 className="text-base font-semibold">확정 취소</h2>
          <p>
            {record.cancelledBy} · {formatDateTime(record.cancelledAt)}
          </p>
          <p>{record.cancelReason}</p>
        </section>
      )}
      <AttachmentManager
        attachmentId={attachmentId}
        refModule="INVDOC"
        refId={id ?? null}
        disabled={disabled}
        onBusyChange={setBusy}
        onError={setError}
        onAttachmentIdChange={setAttachmentId}
      />
      {record?.confirmedAt && (
        <p className="text-xs">
          확정: {record.confirmedBy} · {formatDateTime(record.confirmedAt)}
        </p>
      )}
      {record && <DocumentAudit record={record} />}
    </form>
  )
}
