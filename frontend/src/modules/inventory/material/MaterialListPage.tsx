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
      ...(searchVal.trim() ? { searchType, searchVal: searchVal.trim() } : {}),
    })
  }
  if (!hasPermission('material:read')) return <Navigate to="/" replace />
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base font-semibold">자재 마스터</h1>
        <div className="flex gap-2">
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
            disabled={!hasPermission('material:create')}
            onClick={() => navigate('/material/new')}
          >
            신규
          </Button>
        </div>
      </div>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <Select
          aria-label="검색 기준"
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as typeof searchType)}
        >
          <option value="name">자재명</option>
          <option value="materialId">자재번호</option>
          <option value="typeCode">자재 유형</option>
        </Select>
        <Input
          aria-label="검색어"
          value={searchVal}
          maxLength={200}
          onChange={(e) => setSearchVal(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          조회
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[950px]">
          <DataTable<Material>
            rows={loading || error ? [] : rows}
            emptyText={loading ? '조회 중...' : '등록된 자재가 없습니다.'}
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
      <div className="flex items-center justify-end gap-2 text-xs">
        <span>
          전체 {total}건 / {query.page} 페이지
        </span>
        <Button
          variant="secondary"
          disabled={loading || query.page <= 1}
          onClick={() => changeQuery({ ...query, page: query.page - 1 })}
        >
          이전
        </Button>
        <Button
          variant="secondary"
          disabled={loading || query.page * limit >= total}
          onClick={() => changeQuery({ ...query, page: query.page + 1 })}
        >
          다음
        </Button>
      </div>
    </section>
  )
}
