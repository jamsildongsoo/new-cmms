import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getApprovalBox,
  type Approval,
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

export function ApprovalListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requested = params.get('box')
  const activeBox: ApprovalBox =
    boxes.find((box) => box.key === requested)?.key ?? 'submit'
  const [rows, setRows] = useState<Approval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getApprovalBox(activeBox)
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [activeBox])

  const startLoading = () => {
    setIsLoading(true)
    setError(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Approvals</h1>
          <p className="text-xs text-slate-500">
            Draft, submit, process, and review approval documents
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() =>
              printDocument({
                title: '결재 목록',
                columns: [
                  '작성일',
                  '문서번호',
                  '관리번호',
                  '제목',
                  '상신자',
                  '상태',
                ],
                rows: rows.map((row) => [
                  formatDate(row.createdAt),
                  row.approvalId,
                  row.documentNo,
                  row.title,
                  row.submitterId,
                  row.status,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button onClick={() => navigate('/approvals/new')}>신규</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {boxes.map((box) => (
          <button
            key={box.key}
            type="button"
            onClick={() => {
              startLoading()
              setParams({ box: box.key })
            }}
            className={[
              'h-8 border-b-2 px-3 text-xs font-medium',
              activeBox === box.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            ].join(' ')}
          >
            {box.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable<Approval>
        gridTemplateColumns="190px 150px 160px 1fr 120px 90px"
        columns={[
          {
            key: 'createdAt',
            label: 'Created',
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: 'systemDocumentId',
            label: '문서번호',
            render: (r) => r.approvalId,
          },
          {
            key: 'documentNo',
            label: '관리번호',
            render: (row) => row.documentNo || '-',
          },
          {
            key: 'title',
            label: 'Title',
            render: (row) => (
              <Link
                className="text-blue-700 underline"
                to={`/approvals/${row.approvalId}`}
              >
                {row.title}
              </Link>
            ),
          },
          {
            key: 'submitter',
            label: 'Submitter',
            render: (row) => row.submitterId,
          },
          {
            key: 'status',
            label: 'Status',
            render: (row) => <StatusBadge status={row.status} />,
          },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No approvals'}
      />
    </section>
  )
}
