import {
  createWarehouse,
  deleteWarehouse,
  getWarehouses,
  updateWarehouse,
  type Warehouse,
  type WarehousePayload,
} from '../api/organization.api'
import { MasterPage } from './MasterPage'

export function WarehousesPage() {
  return (
    <MasterPage<Warehouse, WarehousePayload>
      title="Warehouses"
      subtitle="Warehouse master data by site"
      permissionPrefix="warehouse"
      idLabel="warehouse"
      getId={(row) => row.warehouseId}
      emptyForm={{ warehouseId: '', siteId: '', name: '' }}
      fields={[
        {
          key: 'warehouseId',
          label: 'Warehouse ID',
          required: true,
          disabledOnEdit: true,
        },
        { key: 'name', label: 'Name', required: true },
        { key: 'siteId', label: 'Site ID' },
      ]}
      columns={[
        {
          key: 'warehouseId',
          label: 'Warehouse ID',
          render: (row) => row.warehouseId,
        },
        { key: 'name', label: 'Name', render: (row) => row.name },
        { key: 'siteId', label: 'Site ID', render: (row) => row.siteId ?? '-' },
      ]}
      toForm={(row) => ({
        warehouseId: row.warehouseId,
        siteId: row.siteId ?? '',
        name: row.name,
      })}
      loadRows={getWarehouses}
      createRow={createWarehouse}
      updateRow={updateWarehouse}
      deleteRow={deleteWarehouse}
    />
  )
}
