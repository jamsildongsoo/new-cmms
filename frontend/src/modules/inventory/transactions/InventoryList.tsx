import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 권한 원본: backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { Select } from '@/shared/ui/Select'
import { DataTable } from '@/shared/ui/DataTable'
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'

import { inventoryLabel, useMetadata } from '@/shared/metadata/metadata'
import { inventoryApi, type InventoryListItem } from './inventory.api'
import { inventoryMenus, type InventoryMenu } from './inventory.navigation'
export function InventoryList({ mode = 'IN' }: { mode?: InventoryMenu }) {
  const { inventoryVariants, inventoryStatuses } = useMetadata()
  const { hasPermission } = useAuth(),
    navigate = useNavigate(),
    menu = inventoryMenus[mode]
  const [result, setResult] = useState({
    items: [] as InventoryListItem[],
    total: 0,
    limit: 20,
  })
  const [search, setSearch] = useState(''),
    [searchType, setSearchType] = useState('title'),
    [status, setStatus] = useState('')
  const [query, setQuery] = useState({ page: 1, search: '', searchType: 'title', status: '' })
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const canRead = hasPermission('INVDOC:read')
  const statusLabel = (value: string) =>
    inventoryStatuses.find((s) => s.value === value)?.label ?? value
  useEffect(() => {
    if (!canRead) return
    let active = true
    inventoryApi
      .list({
        ...query,
        type: menu.type,
        ...(mode === 'OUT' || mode === 'TRANSFER'
          ? { kind: menu.kind! }
          : {}),
      })
      .then((rows) => {
        if (active) setResult(rows)
      })
      .catch((e) => {
        if (active) {
          setError(toMessage(e))
          setResult({ items: [], total: 0, limit: 20 })
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, mode, menu, canRead])
  function change(
    page: number,
    value = query.search,
    selectedStatus = query.status,
    selectedType = query.searchType,
  ) {
    setLoading(true)
    setError('')
    setQuery({ page, search: value, searchType: selectedType, status: selectedStatus })
  }
  if (!canRead) return <p role="alert">조회 권한이 없습니다.</p>
  const rows = loading || error ? [] : result.items
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between">
        <h1 className="text-lg font-semibold">{menu.label}</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || !!error}
            onClick={() =>
              printDocument({
                title: `${menu.label} 목록`,
                columns: [
                  '문서번호',
                  '제목',
                  '유형',
                  '전기일',
                  '사업장',
                  '창고',
                  '상태',
                ],
                rows: rows.map((r) => [
                  r.inventoryDocumentId,
                  r.title,
                  inventoryLabel(inventoryVariants, r.type, r.kind),
                  dateInput(r.postingDate),
                  r.siteId,
                  r.warehouseId,
                  statusLabel(r.status),
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('INVDOC:create')}
            onClick={() => navigate(`${menu.path}/new`)}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <TypedSearchForm
        options={[{ value: 'id', label: '문서번호' }, { value: 'documentNo', label: '관리번호' },
          { value: 'title', label: '제목' }, { value: 'createdBy', label: '작성자' }]}
        searchType={searchType} onSearchTypeChange={setSearchType}
        search={search} onSearchChange={setSearch} loading={loading}
        onSubmit={(event) => { event.preventDefault(); change(1, search.trim(), status, searchType) }}
        onReset={() => { setSearch(''); setSearchType('title'); setStatus(''); change(1, '', '', 'title') }}
        extra={<label className="block space-y-1.5 lg:max-w-xs">
          <span className="block text-sm font-medium text-slate-700">상태</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">전체 상태</option>
            {inventoryStatuses.filter((item) => mode === 'IN' || item.value !== 'W').map((item) =>
              <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </label>}
      />
      {error && <p role="alert">{error}</p>}
      <DataTable
        gridTemplateColumns="210px 130px 1fr 110px 110px 100px 100px 90px"
        rows={rows}
        columns={[
          {
            key: 'id',
            label: '문서번호',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`/inventory-document/${encodeURIComponent(r.inventoryDocumentId)}`}
              >
                {r.inventoryDocumentId}
              </Link>
            ),
          },
          { key: 'no', label: '관리번호', render: (r) => r.documentNo },
          { key: 'title', label: '제목', render: (r) => r.title },
          {
            key: 'type',
            label: '수불 유형',
            render: (r) =>
              inventoryLabel(inventoryVariants, r.type, r.kind),
          },
          {
            key: 'date',
            label: '전기일',
            render: (r) => dateInput(r.postingDate),
          },
          { key: 'site', label: '사업장', render: (r) => r.siteId },
          {
            key: 'warehouse',
            label: '창고',
            render: (r) => r.warehouseId,
          },
          {
            key: 'status',
            label: '상태',
            render: (r) => statusLabel(r.status),
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
