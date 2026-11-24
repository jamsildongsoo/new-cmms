import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { PRIORITIES as priorities } from './priority'
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
  getWorkRequests,
  type WorkRequestListItem,
  type WorkRequestSearch,
} from './workRequest.api'
export function WorkRequestListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<WorkRequestListItem[]>([])
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('title')
  const [query, setQuery] = useState<WorkRequestSearch>({ page: 1 })
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getWorkRequests(query)
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
  if (!hasPermission('WRKREQ:read')) return <Navigate to="/" replace />
  const filter = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setQuery({ page: 1, search: search.trim() || undefined, searchType: search.trim() ? searchType as WorkRequestSearch['searchType'] : undefined })
  }
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between">
        <h1 className="text-lg font-semibold">작업의뢰서</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() =>
              printDocument({
                title: '작업의뢰서 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '의뢰명',
                  '설비',
                  '발생일',
                  '긴급도',
                  '상태',
                ],
                rows: rows.map((r) => [
                  r.workRequestId,
                  r.documentNo,
                  r.title,
                  r.equipmentId,
                  dateInput(r.occurredDate),
                  priorities.find((p) => p.value === r.priorityCode)
                    ?.label ?? r.priorityCode,
                  r.status,
                ]),
              })
            }
          >
            현재 페이지 인쇄
          </Button>
          <Button
            disabled={!hasPermission('WRKREQ:create')}
            onClick={() => navigate('/work-request/new')}
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
      <DataTable<WorkRequestListItem>
        gridTemplateColumns="200px 150px minmax(180px,1fr) 120px 110px 90px 80px"
        rows={loading || error ? [] : rows}
        emptyText={
          loading
            ? '불러오는 중…'
            : error
              ? '조회에 실패했습니다.'
              : '등록된 작업의뢰서가 없습니다.'
        }
        columns={[
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.workRequestId,
          },
          {
            key: 'documentNo',
            label: '관리번호',
            render: (r) => r.documentNo,
          },
          {
            key: 'title',
            label: '의뢰명',
            render: (r) => (
              <Link
                className="text-blue-700 underline"
                to={`/work-request/${encodeURIComponent(r.workRequestId)}`}
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
            key: 'occurredDate',
            label: '발생일',
            render: (r) => dateInput(r.occurredDate),
          },
          {
            key: 'priorityCode',
            label: '긴급도',
            render: (r) =>
              priorities.find((p) => p.value === r.priorityCode)?.label ??
              r.priorityCode ??
              '',
          },
          {
            key: 'status',
            label: '상태',
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
      />
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
