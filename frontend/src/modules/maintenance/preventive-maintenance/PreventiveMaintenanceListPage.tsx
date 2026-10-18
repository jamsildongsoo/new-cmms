import { Eye, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { toPreventiveMaintenanceDraft } from './approvalDraft'
import {
  deletePreventiveMaintenance,
  getPreventiveMaintenanceList,
  type PreventiveMaintenance,
} from './preventiveMaintenance.api'

export function PreventiveMaintenanceListPage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<PreventiveMaintenance[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('preventive_maintenance:create')
  const canUpdate = hasPermission('preventive_maintenance:update')
  const canDelete = hasPermission('preventive_maintenance:delete')
  const canRequest = canUpdate && hasPermission('approval:create')

  useEffect(() => {
    let active = true
    getPreventiveMaintenanceList()
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = () => {
    setIsLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }

  const remove = async (row: PreventiveMaintenance) => {
    if (!window.confirm('Delete this draft document?')) {
      return
    }
    try {
      await deletePreventiveMaintenance(row.pmId)
      reload()
    } catch (deleteError) {
      setError(toMessage(deleteError))
    }
  }

  const requestApproval = (row: PreventiveMaintenance) =>
    navigate('/approvals/new', {
      state: { prefill: toPreventiveMaintenanceDraft(row) },
    })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          Preventive Maintenance
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reload} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/preventive-maintenance/new')}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable
        gridTemplateColumns="140px 1fr 140px 110px 90px 260px"
        rows={rows}
        emptyText={isLoading ? 'Loading...' : undefined}
        columns={[
          { key: 'documentNo', label: 'Document No', render: (r) => r.documentNo },
          { key: 'title', label: 'Title', render: (r) => r.title },
          { key: 'equipmentId', label: 'Equipment', render: (r) => r.equipmentId },
          { key: 'plannedDate', label: 'Planned', render: (r) => r.plannedDate ?? '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/preventive-maintenance/${row.pmId}`)}
                >
                  <Eye className="h-3 w-3" />
                  View
                </Button>
                {row.status === 'D' && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canRequest}
                      onClick={() => requestApproval(row)}
                    >
                      <Send className="h-3 w-3" />
                      Approval
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!canDelete}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
