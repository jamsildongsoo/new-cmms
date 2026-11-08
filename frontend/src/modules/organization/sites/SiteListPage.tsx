import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { printDocument } from '@/shared/lib/print'
import { toMessage } from '@/shared/api/errors'
import { getSites, type Site } from './sites.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'

export function SiteListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('site:create')

  useEffect(() => {
    let active = true
    getSites()
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Sites</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() =>
              printDocument({
                title: '사업장 목록',
                columns: ['코드', '명칭'],
                rows: rows.map((row) => [row.siteId, row.name]),
              })
            }
          >
            인쇄
          </Button>
          <Button onClick={() => navigate('/sites/new')} disabled={!canCreate}>
            신규
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable<Site>
        gridTemplateColumns="1fr 1fr"
        columns={[
          {
            key: 'siteId',
            label: 'Site ID',
            render: (row) => (
              <Link
                className="text-blue-700 underline"
                to={`/sites/${encodeURIComponent(row.siteId)}`}
              >
                {row.siteId}
              </Link>
            ),
          },
          { key: 'name', label: 'Name', render: (row) => row.name },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No sites'}
      />
    </section>
  )
}
