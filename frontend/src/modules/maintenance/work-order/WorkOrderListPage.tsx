import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getWorkOrders,
  type WorkOrderListItem,
  type WorkOrderSearch,
} from './workOrder.api'
import { kindName, money } from './workOrderForm'

export function WorkOrderListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<WorkOrderListItem[]>([])
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('title')
  const [query, setQuery] = useState<WorkOrderSearch>({ page: 1 })
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getWorkOrders(query)
      .then((data) => {
        if (!active) return
        setRows(data.items)
        setTotal(data.total)
        setLimit(data.limit)
        setError(null)
      })
      .catch((e) => {
        if (!active) return
        setRows([])
        setTotal(0)
        setError(toMessage(e))
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission('WRKORD:read')) return <Navigate to="/" replace />
  const filter = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setQuery({ page: 1, search: search.trim() || undefined, searchType: search.trim() ? searchType as WorkOrderSearch['searchType'] : undefined })
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">작업 오더</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() =>
              printDocument({
                title: '작업 오더 목록',
                columns: [
                  '구분',
                  '문서번호',
                  '관리번호',
                  '작업명',
                  '설비',
                  '작업일',
                  '총 비용',
                  '상태',
                ],
                rows: rows.map((r) => [
                  kindName(r.orderKind),
                  r.workOrderId,
                  r.documentNo,
                  r.title,
                  r.equipmentId,
                  dateInput(r.workDate),
                  money(r.totalCost),
                  r.status,
                ]),
              })
            }
          >
            현재 페이지 인쇄
          </Button>
          <Button
            disabled={!hasPermission('WRKORD:create')}
            onClick={() => navigate('/work-order/new')}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <TypedSearchForm
        options={[{ value: 'id', label: '문서번호' }, { value: 'documentNo', label: '관리번호' },
          { value: 'title', label: '제목' }, { value: 'equipmentId', label: '설비번호' },
          { value: 'createdBy', label: '작성자' }]}
        searchType={searchType} onSearchTypeChange={setSearchType}
        search={search} onSearchChange={setSearch} loading={loading}
        onSubmit={filter}
        onReset={() => {
          setSearch(''); setSearchType('title'); setLoading(true); setError(null); setQuery({ page: 1 })
        }}
      />
      {error && (
        <div role="alert" className="text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <DataTable<WorkOrderListItem>
            gridTemplateColumns="70px 200px 150px minmax(180px,1fr) 120px 110px 110px 70px"
            rows={loading || error ? [] : rows}
            emptyText={
              loading
                ? '불러오는 중…'
                : error
                  ? '조회에 실패했습니다.'
                  : '등록된 작업 오더가 없습니다.'
            }
            columns={[
              {
                key: 'orderKind',
                label: '구분',
                render: (r) => kindName(r.orderKind),
              },
              {
                key: 'systemDocumentId',
                label: '문서번호',
                render: (r) => r.workOrderId,
              },
              {
                key: 'documentNo',
                label: '관리번호',
                render: (r) => r.documentNo,
              },
              {
                key: 'title',
                label: '작업명',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/work-order/${encodeURIComponent(r.workOrderId)}`}
                  >
                    {r.title}
                  </Link>
                ),
              },
              {
                key: 'equipmentId',
                label: '설비',
                render: (r) => r.equipmentId,
              },
              {
                key: 'workDate',
                label: '작업일',
                render: (r) => dateInput(r.workDate),
              },
              {
                key: 'totalCost',
                label: '총 비용',
                render: (r) => `${money(r.totalCost)}원`,
              },
              {
                key: 'status',
                label: '상태',
                render: (r) => <StatusBadge status={r.status} />,
              },
            ]}
          />
        </div>
      </div>
      <Pagination
        page={query.page ?? 1}
        limit={limit}
        total={total}
        loading={loading}
        error={Boolean(error)}
        onChange={(page) => {
          setLoading(true)
          setQuery((value) => ({ ...value, page }))
        }}
      />
    </section>
  )
}
