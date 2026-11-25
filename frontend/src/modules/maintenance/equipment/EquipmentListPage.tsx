import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { dateInput } from '@/shared/lib/format'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Pagination } from '@/shared/ui/Pagination'
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import { Select } from '@/shared/ui/Select'
import {
  getEquipmentList, getEquipmentOptions,
  type Equipment, type EquipmentOptions, type EquipmentSearch,
} from './equipment.api'
import { isInspectionOverdue } from './equipmentForm'

type SearchType = NonNullable<EquipmentSearch['searchType']>
const emptyFilters = { siteId: '', searchType: 'name' as SearchType, searchVal: '' }
const printColumns = [
  '설비번호', '설비명', '설비유형', '사업장', '담당부서',
  '제조사', '모델', '설치일', '점검일', '다음점검일',
]

export function EquipmentListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<Equipment[]>([])
  const [options, setOptions] = useState<EquipmentOptions>({
    sites: [], departments: [], types: [],
  })
  const [filters, setFilters] = useState({ ...emptyFilters })
  const [query, setQuery] = useState<EquipmentSearch>({ page: 1 })
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getEquipmentOptions()
      .then((value) => { if (active) setOptions(value) })
      .catch((failure) => { if (active) setError(toMessage(failure)) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    getEquipmentList(query)
      .then((result) => {
        if (!active) return
        setRows(result.items)
        setTotal(result.total)
        setLimit(result.limit)
        setError(null)
      })
      .catch((failure) => {
        if (!active) return
        setRows([])
        setTotal(0)
        setError(toMessage(failure))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])

  if (!hasPermission('EQUIP:read')) return <Navigate to="/" replace />
  const changeQuery = (next: EquipmentSearch) => {
    setLoading(true)
    setError(null)
    setQuery(next)
  }
  const search = (event: FormEvent) => {
    event.preventDefault()
    changeQuery({
      page: 1,
      siteId: filters.siteId || undefined,
      ...(filters.searchVal.trim() && {
        searchType: filters.searchType,
        searchVal: filters.searchVal.trim(),
      }),
    })
  }
  const nameOf = (
    choices: { value: string; label: string }[],
    id: string,
  ) => choices.find((choice) => choice.value === id)?.label ?? id
  const printRows = rows.map((row) => [
    row.equipmentId,
    row.name,
    nameOf(options.types, row.typeCode),
    nameOf(options.sites, row.siteId),
    nameOf(options.departments, row.deptId),
    row.maker,
    row.model,
    dateInput(row.installDate),
    dateInput(row.inspectionDate),
    dateInput(row.nextInspectionDate),
  ])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">설비 마스터</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() => printDocument({
              title: '설비 목록 (현재 페이지)',
              columns: printColumns,
              rows: printRows,
            })}
          >
            현재 페이지 인쇄
          </Button>
          <Button
            disabled={!hasPermission('EQUIP:create')}
            onClick={() => navigate('/equipment/new')}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <TypedSearchForm
        options={[{ value: 'name', label: '설비명' }, { value: 'equipmentId', label: '설비번호' },
          { value: 'typeCode', label: '설비유형' }]}
        searchType={filters.searchType}
        onSearchTypeChange={(value) => setFilters((current) => ({ ...current, searchType: value as SearchType }))}
        search={filters.searchVal}
        onSearchChange={(value) => setFilters((current) => ({ ...current, searchVal: value }))}
        referenceLookup={false} loading={loading} onSubmit={search}
        onReset={() => { setFilters({ ...emptyFilters }); changeQuery({ page: 1 }) }}
        extra={<label className="block space-y-1.5 lg:max-w-xs">
          <span className="block text-sm font-medium text-slate-700">사업장</span>
          <Select aria-label="사업장 필터" value={filters.siteId} onChange={(event) =>
            setFilters((current) => ({ ...current, siteId: event.target.value }))}>
            <option value="">전체 사업장</option>
            {options.sites.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </Select>
        </label>}
      />
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <div className="min-w-[1250px]">
          <DataTable<Equipment>
            rows={loading || error ? [] : rows}
            emptyText={
              loading ? '불러오는 중…' : error ? '조회에 실패했습니다.' : '등록된 설비가 없습니다.'
            }
            gridTemplateColumns="110px minmax(160px,1.5fr) 110px 110px 110px 120px 110px 100px 100px 120px"
            columns={[
              {
                key: 'equipmentId',
                label: '설비번호',
                render: (row) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/equipment/${encodeURIComponent(row.equipmentId)}`}
                  >
                    {row.equipmentId}
                  </Link>
                ),
              },
              { key: 'name', label: '설비명', render: (row) => row.name },
              { key: 'typeCode', label: '설비유형', render: (row) => nameOf(options.types, row.typeCode) },
              { key: 'siteId', label: '사업장', render: (row) => nameOf(options.sites, row.siteId) },
              { key: 'deptId', label: '담당부서', render: (row) => nameOf(options.departments, row.deptId) },
              { key: 'maker', label: '제조사', render: (row) => row.maker ?? '' },
              { key: 'model', label: '모델', render: (row) => row.model ?? '' },
              { key: 'installDate', label: '설치일', render: (row) => dateInput(row.installDate) },
              { key: 'inspectionDate', label: '점검일', render: (row) => dateInput(row.inspectionDate) },
              {
                key: 'nextInspectionDate',
                label: '다음점검일',
                render: (row) => (
                  <span className={isInspectionOverdue(row.nextInspectionDate) ? 'font-semibold text-red-700' : ''}>
                    {dateInput(row.nextInspectionDate)}
                    {isInspectionOverdue(row.nextInspectionDate) && ' (기한 경과)'}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>
      <Pagination
        page={query.page}
        limit={limit}
        total={total}
        loading={loading}
        error={Boolean(error)}
        onChange={(page) => changeQuery({ ...query, page })}
      />
    </section>
  )
}
