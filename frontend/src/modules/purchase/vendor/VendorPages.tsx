import { Pagination } from '@/shared/ui/Pagination'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { SearchActions } from '@/shared/ui/SearchActions'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { vendorApi, type Vendor, type VendorFields } from './vendor.api'
const fields = [
  ['name', '거래처명', 150],
  ['registrationNumber', '사업자번호', 50],
  ['representativeName', '대표자', 100],
  ['contactName', '담당자', 100],
  ['phoneNumber', '연락처', 100],
  ['email', '이메일', 200],
  ['address', '주소', 300],
] as const
const emptyForm = {
  vendorId: '',
  name: '',
  registrationNumber: '',
  representativeName: '',
  contactName: '',
  phoneNumber: '',
  email: '',
  address: '',
  note: '',
}
type VendorForm = typeof emptyForm
function toForm(row: Vendor): VendorForm {
  return Object.fromEntries(
    Object.keys(emptyForm).map((key) => [
      key,
      row[key as keyof Vendor] ?? '',
    ]),
  ) as VendorForm
}
export function VendorListPage() {
  const { hasPermission } = useAuth(),
    navigate = useNavigate()
  const [query, setQuery] = useState({ page: 1, search: '' }),
    [search, setSearch] = useState('')
  const [result, setResult] = useState({
      items: [] as Vendor[],
      total: 0,
      limit: 20,
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    vendorApi
      .list(query)
      .then((r) => {
        if (active) setResult(r)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  function change(page: number, value = query.search) {
    setLoading(true)
    setError('')
    setQuery({ page, search: value })
  }
  if (!hasPermission('VENDOR:read')) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between">
        <h1 className="text-lg font-semibold">거래처 관리</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || !!error}
            onClick={() =>
              printDocument({
                title: '거래처 목록 (현재 페이지)',
                columns: [
                  '거래처번호',
                  '거래처명',
                  '사업자번호',
                  '담당자',
                  '연락처',
                  '이메일',
                ],
                rows: result.items.map((r) => [
                  r.vendorId,
                  r.name,
                  r.registrationNumber,
                  r.contactName,
                  r.phoneNumber,
                  r.email,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('VENDOR:create')}
            onClick={() => navigate('/vendor/new')}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <form
        onReset={() => {
          setSearch('')
          change(1, '')
        }}
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault()
          change(1, search.trim())
        }}
      >
        <Input
          aria-label="거래처 검색"
          placeholder="거래처번호·거래처명·사업자번호"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SearchActions loading={loading} />
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <DataTable<Vendor>
        rows={loading || error ? [] : result.items}
        emptyText={loading ? '불러오는 중…' : '등록된 거래처가 없습니다.'}
        gridTemplateColumns="130px 1fr 160px 130px 150px"
        columns={[
          {
            key: 'vendorId',
            label: '거래처번호',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`/vendor/${encodeURIComponent(r.vendorId)}`}
              >
                {r.vendorId}
              </Link>
            ),
          },
          { key: 'name', label: '거래처명', render: (r) => r.name },
          {
            key: 'registrationNumber',
            label: '사업자번호',
            render: (r) => r.registrationNumber,
          },
          {
            key: 'contactName',
            label: '담당자',
            render: (r) => r.contactName,
          },
          {
            key: 'phoneNumber',
            label: '연락처',
            render: (r) => r.phoneNumber,
          },
        ]}
      />
      <Pagination
        page={query.page}
        limit={result.limit}
        total={result.total}
        loading={loading}
        error={Boolean(error)}
        onChange={change}
      />
    </section>
  )
}
export function VendorFormPage() {
  const { vendorId } = useParams()
  return <VendorEditor key={vendorId ?? 'new'} id={vendorId} />
}
function VendorEditor({ id }: { id?: string }) {
  const { hasPermission } = useAuth(),
    navigate = useNavigate()
  const [form, setForm] = useState({ ...emptyForm }),
    [record, setRecord] = useState<Vendor | null>(null),
    [baseline, setBaseline] = useState(JSON.stringify(emptyForm))
  const [ready, setReady] = useState(!id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const confirmLeave = useUnsavedChanges(
    ready && JSON.stringify(form) !== baseline,
  )
  useEffect(() => {
    if (!id) return
    let active = true
    vendorApi
      .get(id)
      .then((r) => {
        if (!active) return
        const loaded = toForm(r)
        setForm(loaded)
        setBaseline(JSON.stringify(loaded))
        setRecord(r)
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [id])
  if (!hasPermission(id ? 'VENDOR:read' : 'VENDOR:create'))
    return <Navigate to="/" replace />
  const readOnly = !hasPermission(id ? 'VENDOR:update' : 'VENDOR:create'),
    disabled = readOnly || busy || !ready
  async function save(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    setBusy(true)
    setError('')
    const payload = Object.fromEntries(
      Object.entries(form)
        .filter(([key]) => key !== 'vendorId')
        .map(([key, value]) => [key, value.trim() || null]),
    ) as unknown as VendorFields
    try {
      const row = id
        ? await vendorApi.update(id, payload)
        : await vendorApi.create(form.vendorId.trim(), payload)
      const loaded = toForm(row)
      setForm(loaded)
      setBaseline(JSON.stringify(loaded))
      setRecord(row)
      if (!id)
        navigate(`/vendor/${encodeURIComponent(row.vendorId)}`, {
          replace: true,
        })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!id || busy) return
    setBusy(true)
    setError('')
    try {
      const { purchaseOrderCount } = await vendorApi.deletionInfo(id)
      const message =
        purchaseOrderCount > 0
          ? `이 거래처로 등록된 발주가 ${purchaseOrderCount}건 있습니다. 기존 발주 정보는 유지됩니다. 거래처를 삭제하시겠습니까?`
          : '거래처를 삭제하시겠습니까?'
      if (!window.confirm(message)) return
      await vendorApi.remove(id)
      navigate('/vendor')
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
      onSubmit={(e) => void save(e)}
    >
      <div className="flex flex-wrap justify-between">
        <h1 className="text-lg font-semibold">거래처 관리</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (confirmLeave()) navigate('/vendor')
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!ready || busy}
            onClick={() =>
              printDocument({
                title: '거래처 정보',
                fields: [
                  ['거래처번호', form.vendorId],
                  ...fields.map(
                    ([key, label]) =>
                      [label, form[key]] as [string, string],
                  ),
                  ['비고', form.note],
                ],
              })
            }
          >
            인쇄
          </Button>
          {id && hasPermission('VENDOR:delete') && (
            <Button
              className="sm:ml-2"
              type="button"
              variant="danger"
              disabled={busy || !ready}
              onClick={() => void remove()}
            >
              삭제
            </Button>
          )}
          {!readOnly && (
            <Button type="submit" disabled={disabled}>
              저장
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {!ready && !error && <p className="text-xs">불러오는 중…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="거래처번호" required>
          <Input
            required
            maxLength={50}
            value={form.vendorId}
            disabled={disabled || !!id}
            onChange={(e) =>
              setForm((f) => ({ ...f, vendorId: e.target.value }))
            }
          />
        </Field>
        {fields.map(([key, label, maxLength]) => (
          <Field key={key} label={label} required={key === 'name'}>
            <Input
              required={key === 'name'}
              maxLength={maxLength}
              value={form[key]}
              disabled={disabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
      </div>
      <Field label="비고">
        <Textarea
          value={form.note}
          disabled={disabled}
          onChange={(e) =>
            setForm((f) => ({ ...f, note: e.target.value }))
          }
        />
      </Field>
      {record && (
        <p className="text-xs text-slate-500">
          등록: {record.createdBy} / {record.createdAt} · 수정:{' '}
          {record.updatedBy ?? '-'} / {record.updatedAt ?? '-'}
        </p>
      )}
    </form>
  )
}
