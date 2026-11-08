import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getWorkRequests,
  getWorkRequestOptions,
  type WorkRequest,
  type WorkRequestSearch,
} from './workRequest.api'
const dateInput = (value: string) =>
  value ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : ''
export function WorkRequestListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<WorkRequest[]>([])
  const [search, setSearch] = useState<WorkRequestSearch>({
    searchType: 'title',
  })
  const [query, setQuery] = useState<WorkRequestSearch>({})
  const [priorities, setPriorities] = useState<
    { value: string; label: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getWorkRequestOptions()
      .then((data) => active && setPriorities(data.priorities))
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    getWorkRequests(query)
      .then((data) => active && setRows(data))
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission('work_request:read')) return <Navigate to="/" replace />
  const filter = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setQuery({
      ...search,
      occurredDateFrom:
        search.occurredDateFrom?.replaceAll('-', '') || undefined,
      occurredDateTo: search.occurredDateTo?.replaceAll('-', '') || undefined,
    })
  }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">작업의뢰서</h1>
        <div className="flex gap-2">
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
                  priorities.find((p) => p.value === r.priorityCode)?.label ??
                    r.priorityCode,
                  r.status,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('work_request:create')}
            onClick={() => navigate('/work-request/new')}
          >
            신규
          </Button>
        </div>
      </div>
      <form
        onSubmit={filter}
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7"
      >
        <Select
          aria-label="상태 필터"
          value={search.status ?? ''}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              status:
                (e.target.value as WorkRequestSearch['status']) || undefined,
            }))
          }
        >
          <option value="">전체 상태</option>
          {[
            ['D', '작성'],
            ['P', '진행'],
            ['C', '승인완료'],
            ['R', '반려'],
            ['X', '취소'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="긴급도 필터"
          value={search.priorityCode ?? ''}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              priorityCode: e.target.value || undefined,
            }))
          }
        >
          <option value="">전체 긴급도</option>
          {priorities.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="검색 기준"
          value={search.searchType ?? 'title'}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              searchType: e.target.value as WorkRequestSearch['searchType'],
            }))
          }
        >
          <option value="title">의뢰명</option>
          <option value="documentNo">관리번호</option>
          <option value="equipmentId">설비번호</option>
        </Select>
        <Input
          aria-label="검색어"
          value={search.searchVal ?? ''}
          onChange={(e) =>
            setSearch((s) => ({ ...s, searchVal: e.target.value }))
          }
        />
        <Input
          aria-label="발생일 시작"
          type="date"
          value={search.occurredDateFrom ?? ''}
          onChange={(e) =>
            setSearch((s) => ({ ...s, occurredDateFrom: e.target.value }))
          }
        />
        <Input
          aria-label="발생일 종료"
          type="date"
          min={search.occurredDateFrom}
          value={search.occurredDateTo ?? ''}
          onChange={(e) =>
            setSearch((s) => ({ ...s, occurredDateTo: e.target.value }))
          }
        />
        <Button type="submit" variant="secondary" disabled={loading}>
          조회
        </Button>
      </form>
      {error && (
        <div role="alert" className="text-xs text-red-700">
          {error}
        </div>
      )}
      <DataTable<WorkRequest>
        gridTemplateColumns="190px 120px 1fr 120px 110px 90px 80px"
        rows={loading || error ? [] : rows}
        emptyText={
          loading
            ? '조회 중...'
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
          { key: 'documentNo', label: '관리번호', render: (r) => r.documentNo },
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
          { key: 'equipmentId', label: '설비', render: (r) => r.equipmentId },
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
    </section>
  )
}
