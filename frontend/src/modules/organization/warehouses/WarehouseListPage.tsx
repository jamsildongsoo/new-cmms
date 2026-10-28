import { Edit3, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  deleteWarehouse,
  getWarehouses,
  type Warehouse,
} from './warehouses.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'

export function WarehouseListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('warehouse:create')
  const canUpdate = hasPermission('warehouse:update')
  const canDelete = hasPermission('warehouse:delete')

  useEffect(() => {
    let active = true
    getWarehouses()
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
      setRows(await getWarehouses())
    } catch (loadError) {
      setError(toMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }

  const removeRow = async (row: Warehouse) => {
    if (!window.confirm(`Delete warehouse ${row.warehouseId}?`)) {
      return
    }
    try {
      await deleteWarehouse(row.warehouseId)
      await reload()
    } catch (deleteError) {
      setError(toMessage(deleteError))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Warehouses</h1>
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
          <Button onClick={() => navigate('/warehouses/new')} disabled={!canCreate}>
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

      <DataTable<Warehouse>
        gridTemplateColumns="1fr 1fr 1fr 220px"
        columns={[
          { key: 'warehouseId', label: 'Warehouse ID', render: (row) => row.warehouseId },
          { key: 'name', label: 'Name', render: (row) => row.name },
          { key: 'siteId', label: 'Site ID', render: (row) => row.siteId ?? '-' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/warehouses/${encodeURIComponent(row.warehouseId)}`)}
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    navigate(`/warehouses/${encodeURIComponent(row.warehouseId)}/edit`)
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
        emptyText={isLoading ? 'Loading...' : 'No warehouses'}
      />
    </section>
  )
}
