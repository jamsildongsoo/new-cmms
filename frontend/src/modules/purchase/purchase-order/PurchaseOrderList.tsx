import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useStatusLabels } from '@/shared/metadata/metadata'
import { SearchActions } from '@/shared/ui/SearchActions'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  purchaseOrderApi,
  purchaseOrderBase as base,
  purchaseOrderLabel,
  type PurchaseOrderListItem,
} from './purchase-order.api'

export function PurchaseOrderList() {
  const documentStatusLabels = useStatusLabels()
  const { hasPermission } = useAuth(),
    navigate = useNavigate(),
    module = 'PURORD'
  const [result, setResult] = useState({
      items: [] as PurchaseOrderListItem[],
      total: 0,
      limit: 20,
    }),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState({ page: 1, search: '' }),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const rows = loading || error ? [] : result.items
  function change(page: number, value = query.search) {
    setLoading(true)
    setError('')
    setQuery({ page, search: value })
  }
  useEffect(() => {
    let active = true
    purchaseOrderApi
      .list(query)
      .then((r) => active && setResult(r))
      .catch((e) => {
        if (active) {
          setResult({ items: [], total: 0, limit: 20 })
          setError(toMessage(e))
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission(`${module}:read`)) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-between">
        <h1 className="text-lg font-semibold">{purchaseOrderLabel}</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || !!error}
            onClick={() =>
              printDocument({
                title: purchaseOrderLabel + ' 목록 (현재 페이지)',
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
                  dateInput(r.orderDate),
                  r.totalAmount,
                  documentStatusLabels[r.status] ?? r.status,
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
            신규 작성
          </Button>
        </div>
      </div>
      <form
        className="search-form"
        onReset={() => {
          setSearch('')
          change(1, '')
        }}
        onSubmit={(e) => {
          e.preventDefault()
          change(1, search.trim())
        }}
      >
        <Input
          aria-label="검색어"
          placeholder="문서번호·관리번호·제목"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SearchActions loading={loading} />
      </form>
      {error && <p role="alert">{error}</p>}
      <DataTable
        rows={rows}
        emptyText={loading ? '불러오는 중…' : '등록된 문서가 없습니다.'}
        gridTemplateColumns="200px 150px 1fr 120px 140px 90px"
        columns={[
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.orderId,
          },
          {
            key: 'documentNo',
            label: '관리번호',
            render: (r) => r.documentNo || '—',
          },
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
            render: (r) => dateInput(r.orderDate),
          },
          {
            key: 'total',
            label: '발주금액',
            render: (r) => r.totalAmount,
          },
          {
            key: 'status',
            label: '상태',
            render: (r) => <StatusBadge status={r.status} />,
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
