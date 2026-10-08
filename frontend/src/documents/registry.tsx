import type { ReactNode } from 'react'
import { PM_MODULE } from '../api/preventiveMaintenance.api'
import { PreventiveMaintenanceForm } from '../pages/PreventiveMaintenanceForm'

interface DocumentModule {
  label: string
  readPermission: string
  renderView: (id: string) => ReactNode
}

// Source-document modules that approvals can link to via refModule/refId.
export const documentModules: Record<string, DocumentModule> = {
  [PM_MODULE]: {
    label: 'Preventive Maintenance',
    readPermission: 'preventive_maintenance:read',
    renderView: (id) => <PreventiveMaintenanceForm mode="view" id={id} />,
  },
}
