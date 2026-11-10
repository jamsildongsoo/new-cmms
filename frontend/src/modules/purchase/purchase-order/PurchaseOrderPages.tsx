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
import { previewAmount, inputDate, today } from '../common/purchase.utils'
const emptyOptions: PurchaseOrderOptions = {
  materials: [],
  sites: [],
  departments: [],
  users: [],
  types: [],
  requests: [],
  vendors: [],
}
export function PurchaseOrderList() {
  const { hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'purchase_order'
  const [rows, setRows] = useState<PurchaseOrderRecord[]>([]),
    [filter, setFilter] = useState({
      search: '',
      status: '',
      from: '',
      to: '',
    }),
    [query, setQuery] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    purchaseOrderApi
      .list(query)
      .then((r) => active && setRows(r))
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission(`${module}:read`)) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex justify-between">
        <h1 className="text-base font-semibold">{purchaseOrderLabel}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() =>
              printDocument({
                title: purchaseOrderLabel + ' 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '제목',
                  '일자',
                  '금액',
                  '상태',
                ],
                rows: rows.map((r) => [
                  r.orderId,
                  r.documentNo,
                  r.title,
                  inputDate(r.orderDate),
                  r.totalAmount,
                  r.status,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission(`${module}:create`)}
            onClick={() => navigate(`${base}/new`)}
          >
            신규
          </Button>
        </div>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setLoading(true)
          setError('')
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
        <Input
          aria-label="검색어"
          placeholder="문서번호·관리번호·제목"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          aria-label="상태"
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">전체 상태</option>
          {['D', 'P', 'C', 'R', 'X'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="시작일"
          value={filter.from}
          onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="종료일"
          value={filter.to}
          onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
        />
        <Button variant="secondary" type="submit">
          조회
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      <DataTable
        rows={rows}
        emptyText={loading ? '조회 중...' : '등록된 문서가 없습니다.'}
        gridTemplateColumns={'190px 120px 1fr 120px 140px 90px'}
        columns={[
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.orderId,
          },
          { key: 'documentNo', label: '관리번호', render: (r) => r.documentNo },
          {
            key: 'title',
            label: '제목',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`${base}/${r.orderId}`}
              >
                {r.title}
              </Link>
            ),
          },
          {
            key: 'date',
            label: '일자',
            render: (r) => inputDate(r.orderDate),
          },
          {
            key: 'total',
            label: '발주금액',
            render: (r: PurchaseOrderRecord) => r.totalAmount,
          },
          {
            key: 'status',
            label: '상태',
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
      />
    </section>
  )
}
export function PurchaseOrderForm() {
  const { id } = useParams()
  return <PurchaseOrderEditor key={`order:${id ?? ''}`} id={id} />
}
function PurchaseOrderEditor({ id }: { id?: string }) {
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'purchase_order'
  const [requestKey] = useState(() => crypto.randomUUID()),
    [record, setRecord] = useState<PurchaseOrderRecord | null>(null),
    [options, setOptions] = useState(emptyOptions)
  const [form, setForm] = useState({
    documentNo: '',
    title: '',
    date: today(),
    dueDate: '',
    siteId: user?.siteId ?? '',
    deptId: user?.deptId ?? '',
    requesterId: user?.userId ?? '',
    typeCode: '',
    content: '',
    note: '',
    vendorId: '',
    deliveryLocation: '',
  })
  const [items, setItems] = useState<PurchaseOrderItem[]>([]),
    [requestIds, setRequestIds] = useState<string[]>([]),
    [attachmentId, setAttachmentId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [warning, setWarning] = useState(''),
    [baseline, setBaseline] = useState(''),
    [requestSearch, setRequestSearch] = useState('')
  const state = JSON.stringify({ form, items, requestIds, attachmentId }),
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
            date: inputDate(row.orderDate),
            dueDate: inputDate(row.expectedDeliveryDate),
            siteId: row.siteId ?? '',
            deptId: row.deptId ?? '',
            requesterId: row.requesterId,
            typeCode: row.typeCode ?? '',
            content: row.content ?? '',
            note: row.note ?? '',
            vendorId: row.vendorId ?? '',
            deliveryLocation: row.deliveryLocation ?? '',
          }
          setForm(loaded)
          setItems(row.items)
          setRequestIds(row.sourceRequestIds ?? [])
          setAttachmentId(row.attachmentId)
          setRecord(row)
          setBaseline(
            JSON.stringify({
              form: loaded,
              items: row.items,
              requestIds: row.sourceRequestIds ?? [],
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
    disabled = readOnly || blocked,
    linked = requestIds.length > 0
  const change = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  const editItem = (
    index: number,
    key: keyof PurchaseOrderItem,
    value: string,
  ) =>
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    )
  async function chooseRequests(ids: string[]) {
    if (disabled) return
    setSaving(true)
    setError('')
    try {
      if (!ids.length) {
        setRequestIds([])
        setItems([])
        setWarning('')
        return
      }
      const preview = await purchaseOrderApi.preview(ids)
      setRequestIds(ids)
      setItems(preview.items)
      setWarning(preview.message ?? '')
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
        orderDate: date.replaceAll('-', ''),
        expectedDeliveryDate: dueDate.replaceAll('-', '') || null,
        attachmentId,
        requestIds,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          ...{ unitPrice: i.unitPrice || null },
          note: i.note,
        })),
      }
      const row = await purchaseOrderApi.save(id ?? requestKey, payload, !id)
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
          JSON.stringify({ form, items: row.items, requestIds, attachmentId }),
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
      (sum, i) => sum + BigInt(previewAmount(i.quantity, i.unitPrice) || '0'),
      0n,
    )
    .toString()
  const selectedVendor =
    options.vendors.find((v) => v.vendorId === form.vendorId) ??
    (record?.vendorId === form.vendorId ? record.vendor : null)
  const print = () =>
    printDocument({
      title: purchaseOrderLabel,
      fields: [
        ['문서번호', record?.orderId],
        ['관리번호', form.documentNo],
        ['제목', form.title],
        ['일자', form.date],
        ['필요일/납기', form.dueDate],
        ['담당자', form.requesterId],
        ['공급처', selectedVendor?.name ?? ''],
        ['벤더번호', form.vendorId] as [string, string],
        ['납품 장소', form.deliveryLocation],
        ['합계', total] as [string, string],
        ['비고', form.note],
      ],
      columns: ['자재번호', '명칭', '규격', '단위', '수량', '단가', '금액'],
      rows: items.map((i) => [
        i.materialId,
        i.materialName,
        i.spec,
        i.baseUnit,
        i.quantity,
        i.unitPrice ?? '미산정',
        previewAmount(i.quantity, i.unitPrice) || '미산정',
      ]),
      text: form.content,
    })
  return (
    <form
      ref={formRef}
      onSubmit={(e: FormEvent) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-3 border bg-white p-3"
    >
      <DocumentIdField value={record?.orderId} />
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-base font-semibold">
          {purchaseOrderLabel}{' '}
          {record && <StatusBadge status={record.status} />}
        </h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!record || blocked}
            onClick={print}
          >
            인쇄
          </Button>
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
          {!readOnly && (
            <Button type="submit" disabled={blocked}>
              저장
            </Button>
          )}
          {id && !readOnly && hasPermission(`${module}:delete`) && (
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
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && <p>조회 중...</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ['documentNo', '관리번호'],
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
              disabled={disabled}
              onChange={(e) => change(key, e.target.value)}
            >
              <option value="">선택</option>
              {form[key] && !choices.some((r) => r.value === form[key]) && (
                <option value={form[key]}>{form[key]} (기존 값)</option>
              )}
              {choices.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
                </option>
              ))}
            </Select>
          </Field>
        ))}
        {
          <Field label="벤더" required>
            <Select
              required
              value={form.vendorId}
              disabled={disabled}
              onChange={(e) => change('vendorId', e.target.value)}
            >
              <option value="">벤더를 선택하십시오</option>
              {form.vendorId &&
                !options.vendors.some((v) => v.vendorId === form.vendorId) && (
                  <option value={form.vendorId}>
                    {form.vendorId} · {selectedVendor?.name} (기존 값)
                  </option>
                )}
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
                onChange={(e) => change('deliveryLocation', e.target.value)}
              />
            </Field>
          </>
        }
      </div>
      {
        <section className="space-y-2 border p-2">
          <h2 className="text-sm font-semibold">
            확정 구매요청 선택 (미선택 시 단독 발주)
          </h2>
          <Input
            aria-label="구매요청 검색"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
            placeholder="문서번호·관리번호·요청명"
          />
          <div className="max-h-48 space-y-1 overflow-auto">
            {options.requests
              .filter((r) =>
                `${r.requestId} ${r.documentNo} ${r.title}`.includes(
                  requestSearch,
                ),
              )
              .map((r) => (
                <label key={r.requestId} className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={requestIds.includes(r.requestId)}
                    onChange={(e) =>
                      void chooseRequests(
                        e.target.checked
                          ? [...requestIds, r.requestId]
                          : requestIds.filter((id) => id !== r.requestId),
                      )
                    }
                  />
                  {r.requestId} {r.documentNo} {r.title}
                  <Link
                    className="text-blue-700 underline"
                    to={`/purchase-request/${r.requestId}`}
                  >
                    원본
                  </Link>
                </label>
              ))}
          </div>
          {requestIds
            .filter((id) => !options.requests.some((r) => r.requestId === id))
            .map((id) => (
              <p key={id} className="text-xs">
                참조: {id}
              </p>
            ))}
          {warning && (
            <p role="status" className="text-xs text-amber-700">
              {warning}
            </p>
          )}
          {linked && (
            <p className="text-xs">요청 전체 품목·수량은 변경할 수 없습니다.</p>
          )}
        </section>
      }
      <section className="space-y-2">
        <div className="flex justify-between">
          <h2 className="text-sm font-semibold">품목</h2>
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
                    unitPrice: null,
                    amount: null,
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
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr>
                {[
                  '자재',
                  '규격',
                  '단위',
                  '수량',
                  '단가',
                  '금액',
                  '비고',
                  '',
                ].map((v, i) => (
                  <th key={i} className="bg-slate-50 p-2">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={8} className="border p-3 text-center">
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
                            (r) => r.materialId === e.target.value,
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
                        {item.materialId &&
                          !options.materials.some(
                            (m) => m.materialId === item.materialId,
                          ) && (
                            <option value={item.materialId}>
                              {item.materialName} ({item.materialId})
                            </option>
                          )}
                        {options.materials.map((m) => (
                          <option key={m.materialId} value={m.materialId}>
                            {m.materialId} / {m.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="border p-1">{item.spec}</td>
                    <td className="border p-1">{item.baseUnit}</td>
                    <td className="border p-1">
                      <Input
                        aria-label={`${index + 1}행 수량`}
                        value={item.quantity}
                        inputMode="decimal"
                        disabled={disabled || linked}
                        onChange={(e) =>
                          editItem(index, 'quantity', e.target.value)
                        }
                      />
                    </td>
                    {
                      <>
                        <td className="border p-1">
                          <Input
                            aria-label={`${index + 1}행 단가`}
                            value={item.unitPrice ?? ''}
                            inputMode="decimal"
                            disabled={disabled}
                            onChange={(e) =>
                              editItem(index, 'unitPrice', e.target.value)
                            }
                          />
                        </td>
                        <td className="border p-1">
                          {previewAmount(item.quantity, item.unitPrice) ||
                            '미산정'}
                        </td>
                      </>
                    }
                    <td className="border p-1">
                      <Input
                        aria-label={`${index + 1}행 비고`}
                        value={item.note ?? ''}
                        disabled={disabled}
                        onChange={(e) =>
                          editItem(index, 'note', e.target.value)
                        }
                      />
                    </td>
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
        {<p className="text-right text-xs">발주금액: {total}원</p>}
      </section>
      {record && record.allocations.length > 0 && (
        <section className="text-xs">
          <h2 className="text-sm font-semibold">구매요청 연결 이력</h2>
          {record.allocations.map((a) => (
            <p key={a.allocationId}>
              <Link
                className="text-blue-700 underline"
                to={`/purchase-request/${a.requestId}`}
              >
                {a.requestId}
              </Link>{' '}
              / 원 품목 {a.requestItemId} / 수량 {a.quantity}
            </p>
          ))}
        </section>
      )}
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
      {record && (
        <p className="text-xs text-slate-500">
          등록자 {record.createdBy} / {record.createdAt} · 수정자{' '}
          {record.updatedBy ?? '-'} / {record.updatedAt ?? '-'}
        </p>
      )}
    </form>
  )
}
