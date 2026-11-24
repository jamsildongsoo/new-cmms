import { Pagination } from '@/shared/ui/Pagination'
// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { TypedSearchForm } from '@/shared/ui/TypedSearchForm'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import {
  getMaterialList,
  type Material,
  type MaterialSearch,
} from './material.api'

export function MaterialListPage() {
  const { hasPermission } = useAuth(),
    navigate = useNavigate()
  const [query, setQuery] = useState<MaterialSearch>({ page: 1 }),
    [searchType, setSearchType] =
      useState<NonNullable<MaterialSearch['searchType']>>('name'),
    [searchVal, setSearchVal] = useState('')
  const [rows, setRows] = useState<Material[]>([]),
    [total, setTotal] = useState(0),
    [limit, setLimit] = useState(20),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getMaterialList(query)
      .then((data) => {
        if (!active) return
        setRows(data.items)
        setTotal(data.total)
        setLimit(data.limit)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  const changeQuery = (next: MaterialSearch) => {
    setLoading(true)
    setError(null)
    setQuery(next)
  }
  const search = (event: FormEvent) => {
    event.preventDefault()
    changeQuery({
      page: 1,
      ...(searchVal.trim()
        ? { searchType, searchVal: searchVal.trim() }
        : {}),
    })
  }
  if (!hasPermission('MATL:read')) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">자재 마스터</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading || Boolean(error)}
            onClick={() =>
              printDocument({
                title: '자재 목록 (현재 페이지)',
                columns: [
                  '자재번호',
                  '자재명',
                  '유형',
                  '기본 단위',
                  '규격',
                  '제조사',
                  '모델',
                ],
                rows: rows.map((r) => [
                  r.materialId,
                  r.name,
                  r.typeCode,
                  r.baseUnit,
                  r.spec,
                  r.maker,
                  r.model,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('MATL:create')}
            onClick={() => navigate('/material/new')}
          >
            신규 작성
          </Button>
        </div>
      </div>
      <TypedSearchForm
        options={[{ value: 'name', label: '자재명' }, { value: 'materialId', label: '자재번호' },
          { value: 'typeCode', label: '자재유형' }]}
        searchType={searchType} onSearchTypeChange={(value) => setSearchType(value as typeof searchType)}
        search={searchVal} onSearchChange={setSearchVal} referenceLookup={false}
        loading={loading} onSubmit={search}
        onReset={() => { setSearchType('name'); setSearchVal(''); changeQuery({ page: 1 }) }}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[950px]">
          <DataTable<Material>
            rows={loading || error ? [] : rows}
            emptyText={
              loading ? '불러오는 중…' : '등록된 자재가 없습니다.'
            }
            gridTemplateColumns="130px 1.5fr 100px 90px 1.5fr 120px 120px"
            columns={[
              {
                key: 'materialId',
                label: '자재번호',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/material/${encodeURIComponent(r.materialId)}`}
                  >
                    {r.materialId}
                  </Link>
                ),
              },
              { key: 'name', label: '자재명', render: (r) => r.name },
              {
                key: 'typeCode',
                label: '자재 유형',
                render: (r) => r.typeCode,
              },
              {
                key: 'baseUnit',
                label: '기본 단위',
                render: (r) => r.baseUnit,
              },
              { key: 'spec', label: '규격', render: (r) => r.spec },
              { key: 'maker', label: '제조사', render: (r) => r.maker },
              { key: 'model', label: '모델', render: (r) => r.model },
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
