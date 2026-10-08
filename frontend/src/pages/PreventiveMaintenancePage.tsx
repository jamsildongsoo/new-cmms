import { Eye, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toMessage } from '../api/errors'
import {
  deletePreventiveMaintenance,
  getPreventiveMaintenanceList,
  type PreventiveMaintenance,
} from '../api/preventiveMaintenance.api'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { FormMode } from '../types/form'
import { toPreventiveMaintenanceDraft } from '../documents/preventiveMaintenanceDraft'
import { PreventiveMaintenanceForm } from './PreventiveMaintenanceForm'

interface FormTarget {
  mode: FormMode
  id?: string
}

export function PreventiveMaintenancePage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<PreventiveMaintenance[]>([])
  const [target, setTarget] = useState<FormTarget | null>(null)
  const [formKey, setFormKey] = useState(0)
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

  const openForm = (next: FormTarget | null) => {
    setTarget(next)
    setFormKey((current) => current + 1)
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
    navigate('/approvals', {
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
            onClick={() => openForm({ mode: 'create' })}
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
                  onClick={() => openForm({ mode: 'view', id: row.pmId })}
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
                      onClick={() => remove(row)}
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

      {target && (
        <div className="border border-slate-200 bg-white">
          <PreventiveMaintenanceForm
            key={formKey}
            mode={target.mode}
            id={target.id}
            canEdit={canUpdate}
            onModeChange={(mode) => openForm({ ...target, mode })}
            onSaved={(saved) => {
              openForm({ mode: 'view', id: saved.pmId })
              reload()
            }}
            onClose={() => openForm(null)}
          />
        </div>
      )}
    </div>
  )
}
