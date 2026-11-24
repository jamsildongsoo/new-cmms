import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { DocumentNumber } from '@/shared/ui/DocumentIdField'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isInspectionOverdue } from '@/modules/maintenance/equipment'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getPreventiveMaintenanceList,
  type PMListItem,
} from './preventiveMaintenance.api'

export function PreventiveMaintenanceListPage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<PMListItem[]>([])
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState<
    'pmId' | 'documentNo' | 'title' | 'equipmentId' | 'createdBy'
  >('title')
  const [query, setQuery] = useState({ page: 1, search: '', searchType: 'title' as typeof searchType })
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('PMAINT:create')

  useEffect(() => {
    let active = true
    getPreventiveMaintenanceList({
      page: query.page,
      search: query.search || undefined,
      searchType: query.search ? query.searchType : undefined,
    })
      .then((data) => {
        if (!active) return
        setRows(data.items)
        setTotal(data.total)
        setLimit(data.limit)
        setError(null)
      })
      .catch((loadError) => {
        if (!active) return
        setRows([])
        setTotal(0)
        setError(toMessage(loadError))
      })
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [query])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">예방점검</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={isLoading || Boolean(error)}
            onClick={() =>
              printDocument({
                title: '예방점검 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '제목',
                  '설비',
                  '점검일',
                  '다음 점검일',
                  '판정',
                  '점검부서',
                  '점검자',
                  '상태',
                ],
                rows: rows.map((row) => [
                  row.pmId,
                  row.documentNo,
                  row.title,
                  row.equipmentId,
                  dateInput(row.inspectionDate),
                  dateInput(row.nextInspectionDate),
                  row.result ?? '',
                  row.deptName || row.deptId || '',
                  row.inspectorName || row.inspectorId || '',
                  row.status,
                ]),
              })
            }
          >
            현재 페이지 인쇄
          </Button>
          <Button
            onClick={() => navigate('/preventive-maintenance/new')}
            disabled={!canCreate}
          >
            신규 작성
          </Button>
        </div>
      </div>

      <TypedSearchForm
        options={[{ value: 'pmId', label: '문서번호' }, { value: 'documentNo', label: '관리번호' },
          { value: 'title', label: '제목' }, { value: 'equipmentId', label: '설비번호' },
          { value: 'createdBy', label: '작성자' }]}
        searchType={searchType} onSearchTypeChange={(value) => setSearchType(value as typeof searchType)}
        search={search} onSearchChange={setSearch} loading={isLoading}
        onSubmit={(event) => {
          event.preventDefault(); setIsLoading(true); setQuery({ page: 1, search: search.trim(), searchType })
        }}
        onReset={() => {
          setSearch(''); setSearchType('title'); setIsLoading(true);
          setQuery({ page: 1, search: '', searchType: 'title' })
        }}
      />
      {error && (
        <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <DataTable
            gridTemplateColumns="200px minmax(160px,1fr) 120px 110px 160px 70px 120px 120px 70px"
            rows={isLoading || error ? [] : rows}
            emptyText={
              isLoading
                ? '불러오는 중…'
                : error
                  ? '조회에 실패했습니다.'
                  : '등록된 점검이 없습니다.'
            }
            columns={[
              {
                key: 'systemDocumentId',
                label: '문서번호 / 관리번호',
                render: (r) => (
                  <DocumentNumber
                    value={r.pmId}
                    documentNo={r.documentNo}
                  />
                ),
              },
              {
                key: 'title',
                label: '점검명',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/preventive-maintenance/${r.pmId}`}
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
                key: 'inspectionDate',
                label: '점검일',
                render: (r) => dateInput(r.inspectionDate),
              },
              {
                key: 'nextInspectionDate',
                label: '다음 점검일',
                render: (r) => (
                  <span
                    className={
                      isInspectionOverdue(r.nextInspectionDate)
                        ? 'rounded bg-red-50 px-1 font-semibold text-red-700'
                        : ''
                    }
                  >
                    {dateInput(r.nextInspectionDate)}
                    {isInspectionOverdue(r.nextInspectionDate) &&
                      ' (기한 경과)'}
                  </span>
                ),
              },
              {
                key: 'result',
                label: '판정',
                render: (r) => r.result || '',
              },
              {
                key: 'deptId',
                label: '점검부서',
                render: (r) => r.deptName || r.deptId || '',
              },
              {
                key: 'inspectorId',
                label: '점검자',
                render: (r) => r.inspectorName || r.inspectorId || '',
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
        page={query.page}
        limit={limit}
        total={total}
        loading={isLoading}
        error={Boolean(error)}
        onChange={(page) => {
          setIsLoading(true)
          setQuery((value) => ({ ...value, page }))
        }}
      />
    </div>
  )
}
