import { Eye, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
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
  { key: 'submit', label: 'Submitted' },
  { key: 'pending', label: 'Pending' },
  { key: 'processed', label: 'Processed' },
  { key: 'closed', label: 'Closed' },
  { key: 'reference', label: 'Reference' },
]

export function ApprovalListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const requested = params.get('box')
  const activeBox: ApprovalBox =
    boxes.find((box) => box.key === requested)?.key ?? 'submit'
  const [rows, setRows] = useState<Approval[]>([])
  const [reloadKey, setReloadKey] = useState(0)
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
  }, [activeBox, reloadKey])

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
            onClick={() => {
              startLoading()
              setReloadKey((current) => current + 1)
            }}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/approvals/new')}
            disabled={!hasPermission('approval:create')}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
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
        gridTemplateColumns="150px 1fr 120px 90px 90px"
        columns={[
          {
            key: 'createdAt',
            label: 'Created',
            render: (row) => formatDate(row.createdAt),
          },
          { key: 'title', label: 'Title', render: (row) => row.title },
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
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/approvals/${row.approvalId}`)}
              >
                <Eye className="h-3 w-3" />
                View
              </Button>
            ),
          },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No approvals'}
      />
    </section>
  )
}
