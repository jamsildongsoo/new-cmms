import {
  createSite,
  deleteSite,
  getSites,
  updateSite,
  type Site,
  type SitePayload,
} from '../api/organization.api'
import { MasterPage } from './MasterPage'

export function SitesPage() {
  return (
    <MasterPage<Site, SitePayload>
      title="Sites"
      subtitle="Physical sites in the current company"
      permissionPrefix="site"
      idLabel="site"
      getId={(row) => row.siteId}
      emptyForm={{ siteId: '', name: '' }}
      fields={[
        { key: 'siteId', label: 'Site ID', required: true, disabledOnEdit: true },
        { key: 'name', label: 'Name', required: true },
      ]}
      columns={[
        { key: 'siteId', label: 'Site ID', render: (row) => row.siteId },
        { key: 'name', label: 'Name', render: (row) => row.name },
      ]}
      toForm={(row) => ({ siteId: row.siteId, name: row.name })}
      loadRows={getSites}
      createRow={createSite}
      updateRow={updateSite}
      deleteRow={deleteSite}
    />
  )
}
