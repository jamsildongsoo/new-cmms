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
  getWorkOrders,
  type WorkOrder,
  type WorkOrderSearch,
} from './workOrder.api'
import { dateInput, kindName, money } from './workOrderForm'

export function WorkOrderListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [search, setSearch] = useState<WorkOrderSearch>({ searchType: 'title' })
  const [query, setQuery] = useState<WorkOrderSearch>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getWorkOrders(query)
      .then((result) => active && setRows(result))
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query])
  if (!hasPermission('work_order:read')) return <Navigate to="/" replace />
  const filter = (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setQuery({
      ...search,
      workDateFrom: search.workDateFrom?.replaceAll('-', '') || undefined,
      workDateTo: search.workDateTo?.replaceAll('-', '') || undefined,
      searchVal: search.searchVal?.trim() || undefined,
    })
  }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">작업 오더</h1>
        <div className="flex gap-2">
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
            인쇄
          </Button>
          <Button
            disabled={!hasPermission('work_order:create')}
            onClick={() => navigate('/work-order/new')}
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
          aria-label="계획/실적 필터"
          value={search.orderKind ?? ''}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              orderKind:
                (e.target.value as WorkOrderSearch['orderKind']) || undefined,
            }))
          }
        >
          <option value="">전체 구분</option>
          <option value="PLAN">계획</option>
          <option value="ACTUAL">실적</option>
        </Select>
        <Select
          aria-label="상태 필터"
          value={search.status ?? ''}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              status:
                (e.target.value as WorkOrderSearch['status']) || undefined,
            }))
          }
        >
          <option value="">전체 상태</option>
          {[
            ['D', '작성'],
            ['P', '진행'],
            ['C', '완결'],
            ['R', '반려'],
            ['X', '취소'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="검색 기준"
          value={search.searchType ?? 'title'}
          onChange={(e) =>
            setSearch((s) => ({
              ...s,
              searchType: e.target.value as WorkOrderSearch['searchType'],
            }))
          }
        >
          <option value="title">작업명</option>
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
          aria-label="작업일 시작"
          type="date"
          value={search.workDateFrom ?? ''}
          onChange={(e) =>
            setSearch((s) => ({ ...s, workDateFrom: e.target.value }))
          }
        />
        <Input
          aria-label="작업일 종료"
          type="date"
          min={search.workDateFrom}
          value={search.workDateTo ?? ''}
          onChange={(e) =>
            setSearch((s) => ({ ...s, workDateTo: e.target.value }))
          }
        />
        <Button variant="secondary" type="submit" disabled={loading}>
          조회
        </Button>
      </form>
      {error && (
        <div role="alert" className="text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <DataTable<WorkOrder>
            gridTemplateColumns="190px 70px 120px 1fr 120px 110px 110px 70px"
            rows={loading || error ? [] : rows}
            emptyText={
              loading
                ? '조회 중...'
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
    </section>
  )
}
