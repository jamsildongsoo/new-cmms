import { Edit3, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  deleteSite,
  getSites,
  type Site,
} from './sites.api'
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
  const canUpdate = hasPermission('site:update')
  const canDelete = hasPermission('site:delete')

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

  const reload = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setRows(await getSites())
    } catch (loadError) {
      setError(toMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  const removeRow = async (row: Site) => {
    if (!window.confirm(`Delete site ${row.siteId}?`)) {
      return
    }
    try {
      await deleteSite(row.siteId)
      await reload()
    } catch (deleteError) {
      setError(toMessage(deleteError))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Sites</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void reload()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/sites/new')} disabled={!canCreate}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable<Site>
        gridTemplateColumns="1fr 1fr 220px"
        columns={[
          { key: 'siteId', label: 'Site ID', render: (row) => row.siteId },
          { key: 'name', label: 'Name', render: (row) => row.name },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/sites/${encodeURIComponent(row.siteId)}`)}
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    navigate(`/sites/${encodeURIComponent(row.siteId)}/edit`)
                  }
                  disabled={!canUpdate}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void removeRow(row)}
                  disabled={!canDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No sites'}
      />
    </section>
  )
}
