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
  purchaseRequestApi,
  purchaseRequestBase as base,
  purchaseRequestLabel,
  type PurchaseRequestRecord,
  type PurchaseRequestItem,
  type PurchaseRequestOptions,
} from './purchase-request.api'
import { purchaseRequestDraft } from './purchase-request.form'
import { inputDate, today } from '../common/purchase.utils'
const emptyOptions: PurchaseRequestOptions = {
  materials: [],
  sites: [],
  departments: [],
  users: [],
  types: [],
}
export function PurchaseRequestList() {
  const { hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'purchase_request'
  const [rows, setRows] = useState<PurchaseRequestRecord[]>([]),
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
    purchaseRequestApi
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
        <h1 className="text-base font-semibold">{purchaseRequestLabel}</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() =>
              printDocument({
                title: purchaseRequestLabel + ' 목록',
                columns: ['문서번호', '관리번호', '제목', '일자', '상태'],
                rows: rows.map((r) => [
                  r.requestId,
                  r.documentNo,
                  r.title,
                  inputDate(r.requestDate),
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
        gridTemplateColumns={'190px 120px 1fr 120px 90px'}
        columns={[
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.requestId,
          },
          { key: 'documentNo', label: '관리번호', render: (r) => r.documentNo },
          {
            key: 'title',
            label: '제목',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`${base}/${r.requestId}`}
              >
                {r.title}
              </Link>
            ),
          },
          {
            key: 'date',
            label: '일자',
            render: (r) => inputDate(r.requestDate),
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
export function PurchaseRequestForm() {
  const { id } = useParams()
  return <PurchaseRequestEditor key={`request:${id ?? ''}`} id={id} />
}
function PurchaseRequestEditor({ id }: { id?: string }) {
  const { user, hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'purchase_request'
  const [requestKey] = useState(() => crypto.randomUUID()),
    [record, setRecord] = useState<PurchaseRequestRecord | null>(null),
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
            date: inputDate(row.requestDate),
            dueDate: inputDate(row.requiredDate),
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
  const editItem = (
    index: number,
    key: keyof PurchaseRequestItem,
    value: string,
  ) =>
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    )
  async function save(submit: boolean) {
    if (disabled || !formRef.current?.reportValidity()) return
    setSaving(true)
    setError('')
    try {
      const { date, dueDate, ...rest } = form
      const payload = {
        ...rest,
        requestDate: date.replaceAll('-', ''),
        requiredDate: dueDate.replaceAll('-', '') || null,
        attachmentId,
        items: items.map((i) => ({
          itemId: i.itemId,
          materialId: i.materialId,
          quantity: i.quantity,
          note: i.note,
        })),
      }
      const row = await purchaseRequestApi.save(id ?? requestKey, payload, !id)
      setRecord(row)
      setBaseline(state)
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: purchaseRequestDraft(row) },
        })
      else if (!id) navigate(`${base}/${row.requestId}`, { replace: true })
      else {
        setItems(row.items)
        setBaseline(JSON.stringify({ form, items: row.items, attachmentId }))
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
  const print = () =>
    printDocument({
      title: purchaseRequestLabel,
      fields: [
        ['문서번호', record?.requestId],
        ['관리번호', form.documentNo],
        ['제목', form.title],
        ['일자', form.date],
        ['필요일/납기', form.dueDate],
        ['담당자', form.requesterId],
        ['비고', form.note],
      ],
      columns: ['자재번호', '명칭', '규격', '단위', '수량'],
      rows: items.map((i) => [
        i.materialId,
        i.materialName,
        i.spec,
        i.baseUnit,
        i.quantity,
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
      <DocumentIdField value={record?.requestId} />
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-base font-semibold">
          {purchaseRequestLabel}{' '}
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
      </div>

      <section className="space-y-2">
        <div className="flex justify-between">
          <h2 className="text-sm font-semibold">품목</h2>
          {!readOnly && (
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
                {['자재', '규격', '단위', '수량', '비고', ''].map((v, i) => (
                  <th key={i} className="bg-slate-50 p-2">
                    {v}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!items.length ? (
                <tr>
                  <td colSpan={6} className="border p-3 text-center">
                    등록된 품목이 없습니다.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.itemId}>
                    <td className="min-w-52 border p-1">
                      <Select
                        aria-label={`${index + 1}행 자재`}
                        disabled={disabled}
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
                        disabled={disabled}
                        onChange={(e) =>
                          editItem(index, 'quantity', e.target.value)
                        }
                      />
                    </td>

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
                      {!readOnly && (
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

        {<p className="text-xs">필요한 비교 견적은 첨부파일로 등록하십시오.</p>}
      </section>
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
      {record && (
        <p className="text-xs text-slate-500">
          등록자 {record.createdBy} / {record.createdAt} · 수정자{' '}
          {record.updatedBy ?? '-'} / {record.updatedAt ?? '-'}
        </p>
      )}
    </form>
  )
}
