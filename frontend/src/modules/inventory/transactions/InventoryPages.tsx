import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import { DataTable } from '@/shared/ui/DataTable'
import {
  inventoryApi,
  type InventoryRecord,
  type InventoryItem,
  type InventoryOptions,
} from './inventory.api'
import { today, dateInput } from '../common/inventory.utils'
const emptyOptions: InventoryOptions = {
  types: [],
  materials: [],
  sites: [],
  warehouses: [],
  departments: [],
  orders: [],
  periods: [],
  transfers: [],
}
export function InventoryList() {
  const { hasPermission } = useAuth(),
    navigate = useNavigate()
  const [rows, setRows] = useState<InventoryRecord[]>([]),
    [options, setOptions] = useState(emptyOptions),
    [error, setError] = useState(''),
    [filter, setFilter] = useState({
      status: '',
      from: '',
      to: '',
      typeCode: '',
    }),
    [query, setQuery] = useState<Record<string, string>>({}),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    Promise.all([inventoryApi.list(query), inventoryApi.options()])
      .then(([r, o]) => {
        if (active) {
          setRows(r)
          setOptions(o)
        }
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission('inventory_document:read'))
    return <Navigate to="/" replace />
  const type = (r: InventoryRecord) =>
    options.types.find((t) => t.value === r.typeCode)?.label ?? r.typeCode
  return (
    <section className="space-y-3">
      <div className="flex justify-between">
        <h1 className="text-base font-semibold">재고처리</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() =>
              printDocument({
                title: '재고전표 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '제목',
                  '유형',
                  'Posting Date',
                  '사업장',
                  '창고',
                  '상태',
                ],
                rows: rows.map((r) => [
                  r.inventoryDocumentId,
                  r.documentNo,
                  r.title,
                  type(r),
                  dateInput(r.postingDate),
                  r.siteId,
                  r.warehouseId,
                  r.status,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('inventory_document:create')}
            onClick={() => navigate('/inventory-document/new')}
          >
            신규
          </Button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setLoading(true)
          setQuery(
            Object.fromEntries(
              Object.entries(filter)
                .filter(([, v]) => v)
                .map(([k, v]) => [
                  k,
                  k === 'from' || k === 'to' ? v.replaceAll('-', '') : v,
                ]),
            ),
          )
        }}
      >
        <Select
          aria-label="유형"
          value={filter.typeCode}
          onChange={(e) =>
            setFilter((f) => ({ ...f, typeCode: e.target.value }))
          }
        >
          <option value="">전체 유형</option>
          {options.types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="상태"
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">전체 상태</option>
          <option value="D">초안</option>
          <option value="C">확정</option>
        </Select>
        <Input
          type="date"
          aria-label="Posting 시작일"
          value={filter.from}
          onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="Posting 종료일"
          value={filter.to}
          onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
        />
        <Button type="submit" variant="secondary">
          조회
        </Button>
      </form>
      {!loading && !options.types.length && hasPermission('code:update') && (
        <Button
          variant="secondary"
          onClick={() =>
            void inventoryApi
              .initializeTypes()
              .then(() => setQuery({ ...query }))
              .catch((e) => setError(toMessage(e)))
          }
        >
          기본 수불유형 등록
        </Button>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <DataTable
            rows={rows}
            gridTemplateColumns="190px 120px 1fr 140px 120px 90px 90px 70px"
            emptyText={loading ? '조회 중...' : '등록된 전표가 없습니다.'}
            columns={[
              {
                key: 'systemDocumentId',
                label: '문서번호',
                render: (r) => r.inventoryDocumentId,
              },
              {
                key: 'documentNo',
                label: '관리번호',
                render: (r) => r.documentNo,
              },
              {
                key: 'title',
                label: '제목',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/inventory-document/${r.inventoryDocumentId}`}
                  >
                    {r.title}
                  </Link>
                ),
              },
              { key: 'type', label: '유형', render: type },
              {
                key: 'postingDate',
                label: 'Posting Date',
                render: (r) => dateInput(r.postingDate),
              },
              { key: 'site', label: '사업장', render: (r) => r.siteId },
              { key: 'warehouse', label: '창고', render: (r) => r.warehouseId },
              {
                key: 'status',
                label: '상태',
                render: (r) => (r.status === 'C' ? '확정' : '초안'),
              },
            ]}
          />
        </div>
      </div>
    </section>
  )
}
export function InventoryForm() {
  const { id } = useParams()
  return <InventoryEditor key={id ?? 'new'} id={id} />
}
function InventoryEditor({ id }: { id?: string }) {
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    [requestKey] = useState(() => crypto.randomUUID()),
    [record, setRecord] = useState<InventoryRecord | null>(null),
    [options, setOptions] = useState(emptyOptions)
  const [form, setForm] = useState({
      documentNo: '',
      title: '',
      typeCode: '',
      postingDate: today(),
      siteId: user?.siteId ?? '',
      warehouseId: '',
      deptId: user?.deptId ?? '',
      toSiteId: '',
      toWarehouseId: '',
      toDeptId: '',
      refId: '',
      reason: '',
      note: '',
    }),
    [items, setItems] = useState<InventoryItem[]>([]),
    [attachmentId, setAttachmentId] = useState<string | null>(null),
    [referenceNo, setReferenceNo] = useState(''),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [baseline, setBaseline] = useState('')
  const state = JSON.stringify({ form, items, attachmentId }),
    initialState = useRef(state),
    confirmLeave = useUnsavedChanges(ready && state !== baseline),
    formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let active = true
    Promise.all([
      inventoryApi.options(),
      id ? inventoryApi.get(id) : Promise.resolve(null),
    ])
      .then(([o, r]) => {
        if (!active) return
        setOptions(o)
        if (r) {
          const loaded = {
            documentNo: r.documentNo,
            title: r.title,
            typeCode: r.typeCode,
            postingDate: dateInput(r.postingDate),
            siteId: r.siteId,
            warehouseId: r.warehouseId,
            deptId: r.deptId ?? '',
            toSiteId: r.toSiteId ?? '',
            toWarehouseId: r.toWarehouseId ?? '',
            toDeptId: r.toDeptId ?? '',
            refId: r.refId ?? '',
            reason: r.reason ?? '',
            note: r.note ?? '',
          }
          setForm(loaded)
          setItems(r.items)
          setAttachmentId(r.attachmentId)
          setReferenceNo(r.referenceNo ?? '')
          setRecord(r)
          setBaseline(
            JSON.stringify({
              form: loaded,
              items: r.items,
              attachmentId: r.attachmentId,
            }),
          )
        } else setBaseline(initialState.current)
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [id])
  const kind =
      options.types.find((t) => t.value === form.typeCode)?.kind ??
      record?.processingKind ??
      '',
    linked = kind === 'PURCHASE_IN' || kind === 'SITE_IN',
    refModule =
      kind === 'PURCHASE_IN'
        ? 'purchase_order'
        : kind === 'SITE_IN'
          ? 'inventory_document'
          : null
  const readOnly =
      id || record
        ? !(
            record?.status === 'D' &&
            record.createdBy === user?.userId &&
            hasPermission('inventory_document:update')
          )
        : !hasPermission('inventory_document:create'),
    blocked = !ready || saving || busy,
    disabled = readOnly || blocked
  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  async function chooseReference(value: string) {
    if (disabled) return
    setSaving(true)
    setError('')
    try {
      if (!value) {
        set('refId', '')
        setItems([])
        setReferenceNo('')
        return
      }
      const src = await inventoryApi.reference(refModule!, value)
      setForm((f) => ({
        ...f,
        refId: value,
        ...(kind === 'SITE_IN'
          ? {
              siteId: src.toSiteId!,
              warehouseId: src.toWarehouseId!,
              deptId: src.toDeptId ?? f.deptId,
            }
          : {}),
      }))
      setItems(
        src.items.map((i) => ({
          ...i,
          itemId: crypto.randomUUID(),
          amount: '0',
          note: null,
        })),
      )
      setReferenceNo(src.referenceNo)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function save(confirm: boolean) {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        postingDate: form.postingDate.replaceAll('-', ''),
        toSiteId: form.toSiteId || null,
        toWarehouseId: form.toWarehouseId || null,
        toDeptId: form.toDeptId || null,
        refModule,
        refId: linked ? form.refId || null : null,
        attachmentId,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          refItemId: i.refItemId,
          note: i.note,
        })),
      }
      let saved = await inventoryApi.save(
        id ?? record?.inventoryDocumentId ?? requestKey,
        payload,
        !id && !record,
      )
      // 확정이 실패해도 저장된 초안은 유지하여 재시도 시 중복 생성하지 않는다.
      setRecord(saved)
      if (confirm) saved = await inventoryApi.confirm(saved.inventoryDocumentId)
      setRecord(saved)
      setItems(saved.items)
      setBaseline(JSON.stringify({ form, items: saved.items, attachmentId }))
      if (!id)
        navigate(`/inventory-document/${saved.inventoryDocumentId}`, {
          replace: true,
        })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (!id || disabled || !window.confirm('초안 전표를 삭제하시겠습니까?'))
      return
    setSaving(true)
    try {
      await inventoryApi.remove(id)
      navigate('/inventory-document')
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }
  if (!hasPermission(`inventory_document:${id ? 'read' : 'create'}`))
    return <Navigate to="/inventory-document" replace />
  const wh = (site: string) =>
      options.warehouses.filter((w) => w.siteId === site),
    month = options.periods.find(
      (p) => p.yearMonth === form.postingDate.slice(0, 7).replace('-', ''),
    )
  return (
    <form
      ref={formRef}
      className="space-y-3 border bg-white p-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void save(false)
      }}
    >
      <DocumentIdField value={record?.inventoryDocumentId} />
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-base font-semibold">
          재고전표 {record?.status === 'C' ? '확정' : record ? '초안' : ''}
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!record || blocked}
            onClick={() =>
              printDocument({
                title: '재고전표',
                fields: [
                  ['문서번호', record?.inventoryDocumentId],
                  ['관리번호', form.documentNo],
                  ['제목', form.title],
                  [
                    '유형',
                    options.types.find((t) => t.value === form.typeCode)
                      ?.label ?? form.typeCode,
                  ],
                  ['Posting Date', form.postingDate],
                  ['사업장/창고', `${form.siteId}/${form.warehouseId}`],
                  [
                    '도착 사업장/창고',
                    `${form.toSiteId}/${form.toWarehouseId}`,
                  ],
                  ['참조번호', referenceNo],
                  ['사유', form.reason],
                  ['비고', form.note],
                ],
                columns: [
                  '자재번호',
                  '명칭',
                  '규격',
                  '단위',
                  '수량',
                  '단가',
                  '금액',
                ],
                rows: items.map((i) => [
                  i.materialId,
                  i.materialName,
                  i.spec,
                  i.baseUnit,
                  i.quantity,
                  i.unitPrice,
                  i.amount,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || saving}
            onClick={() => {
              if (confirmLeave()) navigate('/inventory-document')
            }}
          >
            목록
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={blocked}>
              저장
            </Button>
          )}
          {id && !readOnly && hasPermission('inventory_document:delete') && (
            <Button
              type="button"
              variant="danger"
              disabled={blocked}
              onClick={() => void remove()}
            >
              삭제
            </Button>
          )}
          {!readOnly && hasPermission('inventory_document:update') && (
            <Button
              type="button"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              확정
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && <p>조회 중...</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="관리번호">
          <Input
            maxLength={50}
            value={form.documentNo}
            disabled={disabled}
            onChange={(e) => set('documentNo', e.target.value)}
          />
        </Field>
        <Field label="전표명" required>
          <Input
            required
            maxLength={200}
            value={form.title}
            disabled={disabled}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="수불 유형" required>
          <Select
            required
            value={form.typeCode}
            disabled={disabled}
            onChange={(e) => {
              const t = options.types.find((t) => t.value === e.target.value)
              setForm((f) => ({
                ...f,
                typeCode: e.target.value,
                refId: '',
                toSiteId: t?.kind === 'TRANSFER' ? f.siteId : '',
                toWarehouseId: '',
              }))
              setItems([])
              setReferenceNo('')
            }}
          >
            <option value="">선택</option>
            {options.types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Posting Date" required>
          <Input
            required
            type="date"
            value={form.postingDate}
            disabled={disabled}
            onChange={(e) => set('postingDate', e.target.value)}
          />
          <p
            className={`text-xs ${month && !month.locked ? 'text-green-700' : 'text-red-700'}`}
          >
            {month ? (month.locked ? '마감(Lock)' : 'Open') : '미개방 월'} ·
            실제 처리 시점은 감사필드에 기록됩니다.
          </p>
        </Field>
        {linked && (
          <Field
            label={kind === 'PURCHASE_IN' ? '구매오더' : '타사업장출고'}
            required
          >
            <Select
              required
              disabled={disabled}
              value={form.refId}
              onChange={(e) => void chooseReference(e.target.value)}
            >
              <option value="">선택</option>
              {kind === 'PURCHASE_IN'
                ? options.orders.map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      {o.orderId} {o.documentNo} {o.title}
                    </option>
                  ))
                : options.transfers.map((t) => (
                    <option
                      key={t.inventoryDocumentId}
                      value={t.inventoryDocumentId}
                    >
                      {t.inventoryDocumentId} {t.documentNo} {t.title}
                    </option>
                  ))}
              {form.refId &&
                (kind === 'PURCHASE_IN'
                  ? !options.orders.some((o) => o.orderId === form.refId)
                  : !options.transfers.some(
                      (t) => t.inventoryDocumentId === form.refId,
                    )) && (
                  <option value={form.refId}>
                    {referenceNo || form.refId} (기존 연결)
                  </option>
                )}
            </Select>
          </Field>
        )}
        <Field label="참조번호">
          <Input value={referenceNo} readOnly disabled />
          <>
            {form.refId && (
              <Link
                className="text-xs text-blue-700 underline"
                to={
                  kind === 'PURCHASE_IN'
                    ? `/purchase-order/${form.refId}`
                    : `/inventory-document/${form.refId}`
                }
              >
                원본
              </Link>
            )}
          </>
        </Field>
        <Field label="사업장" required>
          <Select
            required
            disabled={disabled || kind === 'SITE_IN'}
            value={form.siteId}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                siteId: e.target.value,
                warehouseId: '',
                ...(kind === 'TRANSFER'
                  ? { toSiteId: e.target.value, toWarehouseId: '' }
                  : {}),
              }))
            }
          >
            <option value="">선택</option>
            {options.sites.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({s.value})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="창고" required>
          <Select
            required
            disabled={disabled || kind === 'SITE_IN'}
            value={form.warehouseId}
            onChange={(e) => set('warehouseId', e.target.value)}
          >
            <option value="">선택</option>
            {wh(form.siteId).map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>
                {w.name} ({w.warehouseId})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="담당부서">
          <Select
            disabled={disabled || kind === 'SITE_IN'}
            value={form.deptId}
            onChange={(e) => set('deptId', e.target.value)}
          >
            <option value="">선택</option>
            {options.departments.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        {(kind === 'TRANSFER' || kind === 'SITE_OUT') && (
          <>
            <Field label="도착 사업장" required>
              <Select
                required
                disabled={disabled || kind === 'TRANSFER'}
                value={form.toSiteId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    toSiteId: e.target.value,
                    toWarehouseId: '',
                  }))
                }
              >
                <option value="">선택</option>
                {options.sites.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.value})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="도착 창고" required>
              <Select
                required
                disabled={disabled}
                value={form.toWarehouseId}
                onChange={(e) => set('toWarehouseId', e.target.value)}
              >
                <option value="">선택</option>
                {wh(form.toSiteId)
                  .filter(
                    (w) =>
                      form.toSiteId !== form.siteId ||
                      w.warehouseId !== form.warehouseId,
                  )
                  .map((w) => (
                    <option key={w.warehouseId} value={w.warehouseId}>
                      {w.name} ({w.warehouseId})
                    </option>
                  ))}
              </Select>
            </Field>
            {kind === 'SITE_OUT' && (
              <Field label="도착 담당부서">
                <Select
                  disabled={disabled}
                  value={form.toDeptId}
                  onChange={(e) => set('toDeptId', e.target.value)}
                >
                  <option value="">선택</option>
                  {options.departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </>
        )}
      </div>
      <section className="space-y-2">
        <div className="flex justify-between">
          <h2 className="text-sm font-semibold">
            품목 {linked && '(원본 전체 품목·수량)'}
          </h2>
          {!readOnly && !linked && (
            <Button
              type="button"
              variant="secondary"
              disabled={blocked}
              onClick={() =>
                setItems((rows) => [
                  ...rows,
                  {
                    itemId: crypto.randomUUID(),
                    materialId: '',
                    materialName: '',
                    spec: null,
                    baseUnit: '',
                    quantity: '1',
                    unitPrice: '0',
                    amount: '0',
                    refItemId: null,
                    note: null,
                  },
                ])
              }
            >
              품목 추가
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr>
                {['자재', '규격', '단위', '수량', '단가', '금액', ''].map(
                  (v, i) => (
                    <th key={i} className="bg-slate-50 p-2">
                      {v}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="border p-3 text-center">
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.itemId}>
                    <td className="min-w-52 border p-1">
                      <Select
                        aria-label={`${index + 1}행 자재`}
                        disabled={disabled || linked}
                        value={item.materialId}
                        onChange={(e) => {
                          const m = options.materials.find(
                            (m) => m.materialId === e.target.value,
                          )
                          if (m)
                            setItems((rows) =>
                              rows.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      materialId: m.materialId,
                                      materialName: m.name,
                                      spec: m.spec,
                                      baseUnit: m.baseUnit,
                                    }
                                  : r,
                              ),
                            )
                        }}
                      >
                        <option value="">선택</option>
                        {options.materials.map((m) => (
                          <option key={m.materialId} value={m.materialId}>
                            {m.materialId} / {m.name}
                          </option>
                        ))}
                        {item.materialId &&
                          !options.materials.some(
                            (m) => m.materialId === item.materialId,
                          ) && (
                            <option value={item.materialId}>
                              {item.materialName}
                            </option>
                          )}
                      </Select>
                    </td>
                    <td className="border p-1">{item.spec}</td>
                    <td className="border p-1">{item.baseUnit}</td>
                    <td className="border p-1">
                      <Input
                        aria-label={`${index + 1}행 수량`}
                        disabled={disabled || linked}
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) =>
                          setItems((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, quantity: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="border p-1">
                      <Input
                        aria-label={`${index + 1}행 단가`}
                        disabled={
                          disabled ||
                          linked ||
                          !['GENERAL_IN', 'ADJUST'].includes(kind)
                        }
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(e) =>
                          setItems((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? { ...r, unitPrice: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="border p-1">{item.amount}</td>
                    <td className="border p-1">
                      {!readOnly && !linked && (
                        <Button
                          type="button"
                          variant="danger"
                          disabled={blocked}
                          onClick={() =>
                            setItems((rows) =>
                              rows.filter((_, i) => i !== index),
                            )
                          }
                        >
                          삭제
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {kind === 'ADJUST' && (
          <p className="text-xs">
            증가 수량은 양수, 감소 수량은 음수로 입력합니다. 조정 사유는
            필수입니다.
          </p>
        )}
      </section>
      <Field label="처리 사유">
        <Textarea
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
      <AttachmentManager
        attachmentId={attachmentId}
        refModule="inventory_document"
        refId={id ?? null}
        disabled={disabled}
        onBusyChange={setBusy}
        onError={setError}
        onAttachmentIdChange={setAttachmentId}
      />
      {record && (
        <p className="text-xs text-slate-500">
          등록자 {record.createdBy} / {record.createdAt} · 수정/처리자{' '}
          {record.updatedBy ?? '-'} / {record.updatedAt ?? '-'}
        </p>
      )}
    </form>
  )
}
