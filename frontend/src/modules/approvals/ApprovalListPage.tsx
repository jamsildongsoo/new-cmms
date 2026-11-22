import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import { useStatusLabels } from '@/shared/metadata/metadata'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { DocumentNumber } from '@/shared/ui/DocumentIdField'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getApprovalBox,
  type ApprovalListItem,
  type ApprovalPage,
  type ApprovalBox,
} from './approvals.api'
import { formatDate } from './approvalForm'

const boxes: { key: ApprovalBox; label: string }[] = [
  { key: 'submit', label: '상신함' },
  { key: 'pending', label: '대기함' },
  { key: 'processed', label: '처리함' },
  { key: 'closed', label: '종결함' },
  { key: 'reference', label: '참조함' },
]
const emptyFilter = { search: '', status: '' }
const pageSize = 20

export function ApprovalListPage() {
  const documentStatusLabels = useStatusLabels()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const activeBox =
    boxes.find((box) => box.key === params.get('box'))?.key ?? 'submit'
  const [result, setResult] = useState<{
    box: ApprovalBox
    data: ApprovalPage
    requestKey: string
    error: string | null
  } | null>(null)
  const [filter, setFilter] = useState(emptyFilter)
  const [query, setQuery] = useState(emptyFilter)
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)

  const requestKey = JSON.stringify([activeBox, query, page])

  useEffect(() => {
    let active = true
    getApprovalBox(activeBox, {
      page,
      limit: pageSize,
      search: query.search || undefined,
      status: query.status || undefined,
    })
      .then((data) => {
        if (active) {
          if (
            page > 1 &&
            page > Math.max(1, Math.ceil(data.total / data.limit))
          ) {
            setPage(Math.max(1, Math.ceil(data.total / data.limit)))
            return
          }
          setResult({ box: activeBox, data, requestKey, error: null })
        }
      })
      .catch((error) => {
        if (active)
          setResult({
            box: activeBox,
            data: { items: [], total: 0, page, limit: pageSize },
            requestKey,
            error: toMessage(error),
          })
      })
    return () => {
      active = false
    }
  }, [activeBox, retry, page, query, requestKey])

  const isLoading = result?.requestKey !== requestKey
  const error = !isLoading ? result?.error : null
  const rows = isLoading ? [] : (result?.data.items ?? [])
  const total = isLoading ? 0 : (result?.data.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = page
  const reset = () => {
    setFilter(emptyFilter)
    setQuery(emptyFilter)
    setPage(1)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">전자결재</h1>
          <p className="text-xs text-slate-500">
            결재 문서를 작성하고 상신·처리 내역을 확인합니다.
          </p>
        </div>
        <div className="page-actions">
          <Button onClick={() => navigate('/approvals/new')}>신규 작성</Button>
        </div>
      </div>
      <nav
        aria-label="결재 문서함"
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {boxes.map((box) => (
          <button
            key={box.key}
            type="button"
            aria-current={activeBox === box.key ? 'page' : undefined}
            onClick={() => {
              if (box.key === activeBox) return
              setPage(1)
              setParams({ box: box.key })
            }}
            className={`min-h-9 border-b-2 px-3 text-sm font-medium ${activeBox === box.key ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {box.label}
          </button>
        ))}
      </nav>
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery({ ...filter })
          setPage(1)
        }}
      >
        <label className="min-w-40 space-y-1.5">
          <span className="block text-sm font-medium text-slate-700">상태</span>
          <Select
            value={filter.status}
            onChange={(event) =>
              setFilter((value) => ({ ...value, status: event.target.value }))
            }
          >
            <option value="">전체 상태</option>
            {Object.entries(documentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="min-w-48 flex-1 space-y-1.5">
          <span className="block text-sm font-medium text-slate-700">
            검색어
          </span>
          <Input
            value={filter.search}
            onChange={(event) =>
              setFilter((value) => ({ ...value, search: event.target.value }))
            }
            placeholder="문서번호, 관리번호, 제목, 상신자"
          />
        </label>
        <div className="page-actions">
          <Button type="button" variant="secondary" onClick={reset}>
            초기화
          </Button>
          <Button type="submit" disabled={isLoading}>
            검색
          </Button>
        </div>
      </form>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <span>{error}</span>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null)
              setRetry((value) => value + 1)
            }}
          >
            다시 시도
          </Button>
        </div>
      )}
      <p role="status" className="text-xs text-slate-500">
        {isLoading
          ? '불러오는 중…'
          : error
            ? '조회에 실패했습니다.'
            : `검색 결과 ${total.toLocaleString('ko-KR')}건`}
      </p>
      <DataTable<ApprovalListItem>
        gridTemplateColumns="180px 200px minmax(200px,1fr) 120px 90px"
        columns={[
          {
            key: 'createdAt',
            label: '작성일시',
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: 'systemDocumentId',
            label: '문서번호 / 관리번호',
            render: (row) => (
              <DocumentNumber
                value={row.approvalId}
                documentNo={row.documentNo}
              />
            ),
          },
          {
            key: 'title',
            label: '제목',
            render: (row) => (
              <Link
                title={row.title}
                className="block truncate text-blue-700 hover:underline"
                to={`/approvals/${encodeURIComponent(row.approvalId)}`}
              >
                {row.title}
              </Link>
            ),
          },
          {
            key: 'submitter',
            label: '상신자',
            render: (row) => row.submitterId,
          },
          {
            key: 'status',
            label: '상태',
            render: (row) => <StatusBadge status={row.status} />,
          },
        ]}
        rows={rows}
        emptyText={
          isLoading
            ? '불러오는 중…'
            : error
              ? '조회에 실패했습니다.'
              : '조회된 결재 문서가 없습니다.'
        }
      />
      <nav
        aria-label="결재 목록 페이지"
        className="flex items-center justify-end gap-3 text-xs text-slate-600"
      >
        <Button
          variant="secondary"
          disabled={isLoading || Boolean(error) || currentPage === 1}
          onClick={() => setPage(currentPage - 1)}
        >
          이전
        </Button>
        <span>
          {currentPage} / {pages} 페이지
        </span>
        <Button
          variant="secondary"
          disabled={isLoading || Boolean(error) || currentPage >= pages}
          onClick={() => setPage(currentPage + 1)}
        >
          다음
        </Button>
      </nav>
    </section>
  )
}
