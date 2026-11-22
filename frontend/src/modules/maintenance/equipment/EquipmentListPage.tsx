import { Pagination } from '@/shared/ui/Pagination'
import { dateInput } from '@/shared/lib/format'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { SearchActions } from '@/shared/ui/SearchActions'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import {
  getEquipmentList,
  getEquipmentTree,
  getEquipmentOptions,
  type Equipment,
  type EquipmentOptions,
  type EquipmentSearch,
} from './equipment.api'
import { EquipmentTree } from './EquipmentTree'
import { inspectionUnits, isInspectionOverdue } from './equipmentForm'
export function EquipmentListPage() {
  const navigate = useNavigate(),
    { hasPermission } = useAuth()
  const [rows, setRows] = useState<Equipment[]>([]),
    [tree, setTree] = useState<Equipment[]>([]),
    [options, setOptions] = useState<EquipmentOptions>({
      sites: [],
      departments: [],
      types: [],
    })
  const [query, setQuery] = useState<EquipmentSearch>({ page: 1 }),
    [filters, setFilters] = useState({
      siteId: '',
      deptId: '',
      parentEquipmentId: '',
      searchType: 'name' as NonNullable<EquipmentSearch['searchType']>,
      searchVal: '',
    })
  const [total, setTotal] = useState(0),
    [limit, setLimit] = useState(20),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [view, setView] = useState<'list' | 'tree'>('list'),
    [treeSearch, setTreeSearch] = useState('')
  useEffect(() => {
    let active = true
    getEquipmentOptions()
      .then((v) => active && setOptions(v))
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    Promise.all([getEquipmentList(query), getEquipmentTree(query.siteId)])
      .then(([result, nodes]) => {
        if (!active) return
        setRows(result.items)
        setTotal(result.total)
        setLimit(result.limit)
        setTree(nodes)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission('EQUIP:read')) return <Navigate to="/" replace />
  const changeQuery = (q: EquipmentSearch) => {
    setLoading(true)
    setError(null)
    setQuery(q)
  }
  const search = (e: FormEvent) => {
    e.preventDefault()
    changeQuery({
      page: 1,
      siteId: filters.siteId || undefined,
      deptId: filters.deptId || undefined,
      parentEquipmentId: filters.parentEquipmentId || undefined,
      ...(filters.searchVal.trim()
        ? {
            searchType: filters.searchType,
            searchVal: filters.searchVal.trim(),
          }
        : {}),
    })
  }
  const displayRows = view === 'tree' ? tree : rows
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">설비 마스터</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() =>
              printDocument({
                title:
                  view === 'tree'
                    ? '설비 트리 목록'
                    : '설비 목록 (현재 페이지)',
                columns: [
                  '설비번호',
                  '설비명',
                  '상위 설비',
                  '사업장',
                  '부서',
                  '예방점검 대상',
                  '허가 대상',
                  '점검일',
                  '다음 점검일',
                  '법정점검일',
                  '다음 법정점검일',
                ],
                rows: displayRows.map((r) => [
                  r.equipmentId,
                  r.name,
                  r.parentEquipmentId,
                  r.siteId,
                  r.deptId,
                  r.pmTargetYn === 'Y' ? '예' : '아니오',
                  r.permitTargetYn === 'Y' ? '예' : '아니오',
                  dateInput(r.inspectionDate),
                  dateInput(r.nextInspectionDate),
                  dateInput(r.legalInspectionDate),
                  dateInput(r.legalNextInspectionDate),
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('EQUIP:create')}
            onClick={() => navigate('/equipment/new')}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <div className="page-actions">
        <Button
          variant={view === 'list' ? 'primary' : 'secondary'}
          onClick={() => setView('list')}
        >
          목록
        </Button>
        <Button
          variant={view === 'tree' ? 'primary' : 'secondary'}
          onClick={() => setView('tree')}
        >
          트리
        </Button>
      </div>
      <form
        onReset={() => {
          setFilters({
            siteId: '',
            deptId: '',
            parentEquipmentId: '',
            searchType: 'name',
            searchVal: '',
          })
          changeQuery({ page: 1 })
        }}
        onSubmit={search}
        className="search-form"
      >
        <Select
          aria-label="사업장 필터"
          value={filters.siteId}
          onChange={(e) =>
            setFilters((v) => ({
              ...v,
              siteId: e.target.value,
              parentEquipmentId: '',
            }))
          }
        >
          <option value="">전체 사업장</option>
          {options.sites.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {view === 'list' && (
          <>
            <Select
              aria-label="담당 부서 필터"
              value={filters.deptId}
              onChange={(e) =>
                setFilters((v) => ({ ...v, deptId: e.target.value }))
              }
            >
              <option value="">전체 부서</option>
              {options.departments.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="상위 설비 필터"
              value={filters.parentEquipmentId}
              onChange={(e) =>
                setFilters((v) => ({
                  ...v,
                  parentEquipmentId: e.target.value,
                }))
              }
            >
              <option value="">전체 상위 설비</option>
              {tree
                .filter(
                  (i) => !filters.siteId || i.siteId === filters.siteId,
                )
                .map((i) => (
                  <option key={i.equipmentId} value={i.equipmentId}>
                    {i.equipmentId} / {i.name}
                  </option>
                ))}
            </Select>
            <Select
              aria-label="검색 기준"
              value={filters.searchType}
              onChange={(e) =>
                setFilters((v) => ({
                  ...v,
                  searchType: e.target.value as typeof filters.searchType,
                }))
              }
            >
              <option value="name">설비명</option>
              <option value="equipmentId">설비번호</option>
              <option value="typeCode">설비 유형</option>
            </Select>
            <Input
              aria-label="검색어"
              value={filters.searchVal}
              onChange={(e) =>
                setFilters((v) => ({ ...v, searchVal: e.target.value }))
              }
            />
          </>
        )}
        <SearchActions loading={loading} />
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {view === 'tree' ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5">
          <Input
            aria-label="설비 트리 검색"
            placeholder="설비번호 또는 설비명 검색"
            value={treeSearch}
            onChange={(e) => setTreeSearch(e.target.value)}
          />
          {loading ? (
            <p>불러오는 중…</p>
          ) : (
            <>
              {[...new Set(tree.map((i) => i.siteId))].map((site) => (
                <div key={site} className="my-2">
                  <h2 className="text-base font-semibold">
                    {options.sites.find((s) => s.value === site)?.label ??
                      site}
                  </h2>
                  <EquipmentTree
                    items={tree.filter((i) => i.siteId === site)}
                    search={treeSearch}
                  />
                </div>
              ))}
            </>
          )}
        </section>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[1300px]">
              <DataTable<Equipment>
                rows={loading || error ? [] : rows}
                emptyText={
                  loading ? '불러오는 중…' : '등록된 설비가 없습니다.'
                }
                gridTemplateColumns="110px 1.5fr 1.4fr 90px 90px 90px 80px 100px 110px 110px 110px"
                columns={[
                  {
                    key: 'equipmentId',
                    label: '설비번호',
                    render: (r) => (
                      <Link
                        className="text-blue-700 underline"
                        to={`/equipment/${encodeURIComponent(r.equipmentId)}`}
                      >
                        {r.equipmentId}
                      </Link>
                    ),
                  },
                  { key: 'name', label: '설비명', render: (r) => r.name },
                  {
                    key: 'parent',
                    label: '상위 설비',
                    render: (r) =>
                      r.parentEquipmentId ? (
                        <Link
                          className="text-blue-700 underline"
                          to={`/equipment/${encodeURIComponent(r.parentEquipmentId)}`}
                        >
                          {r.parentEquipmentId} /{' '}
                          {tree.find(
                            (i) => i.equipmentId === r.parentEquipmentId,
                          )?.name ?? ''}
                        </Link>
                      ) : (
                        ''
                      ),
                  },
                  {
                    key: 'type',
                    label: '설비 유형',
                    render: (r) => r.typeCode,
                  },
                  {
                    key: 'cycle',
                    label: '점검 주기',
                    render: (r) =>
                      r.inspectionPeriod && r.inspectionUnit
                        ? `${r.inspectionPeriod} ${inspectionUnits.find((u) => u.value === r.inspectionUnit)?.label ?? r.inspectionUnit}`
                        : '',
                  },
                  {
                    key: 'pm',
                    label: '예방점검 대상',
                    render: (r) =>
                      r.pmTargetYn === 'Y' ? '예' : '아니오',
                  },
                  {
                    key: 'permit',
                    label: '허가 대상',
                    render: (r) =>
                      r.permitTargetYn === 'Y' ? '예' : '아니오',
                  },
                  {
                    key: 'date',
                    label: '점검일',
                    render: (r) => dateInput(r.inspectionDate),
                  },
                  {
                    key: 'next',
                    label: '다음 점검일',
                    render: (r) => (
                      <span
                        className={
                          isInspectionOverdue(r.nextInspectionDate)
                            ? 'bg-red-50 font-semibold text-red-700'
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
                    key: 'legal',
                    label: '법정점검일',
                    render: (r) => dateInput(r.legalInspectionDate),
                  },
                  {
                    key: 'legalNext',
                    label: '다음 법정점검일',
                    render: (r) => dateInput(r.legalNextInspectionDate),
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
        </>
      )}
    </section>
  )
}
