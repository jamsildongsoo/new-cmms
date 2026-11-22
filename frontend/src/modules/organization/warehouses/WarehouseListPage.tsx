// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { printDocument } from '@/shared/lib/print'
import { toMessage } from '@/shared/api/errors'
import { getWarehouses, type Warehouse } from './warehouses.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'

export function WarehouseListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('WHSE:create')

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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">창고 관리</h1>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() =>
              printDocument({
                title: '창고 목록',
                columns: ['코드', '명칭', '사업장'],
                rows: rows.map((row) => [
                  row.warehouseId,
                  row.name,
                  row.siteId,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            onClick={() => navigate('/warehouses/new')}
            disabled={!canCreate}
          >
            신규 작성
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable<Warehouse>
        gridTemplateColumns="1fr 1fr 1fr"
        columns={[
          {
            key: 'warehouseId',
            label: '창고번호',
            render: (row) => (
              <Link
                className="text-blue-700 underline"
                to={`/warehouses/${encodeURIComponent(row.siteId)}/${encodeURIComponent(row.warehouseId)}`}
              >
                {row.warehouseId}
              </Link>
            ),
          },
          { key: 'name', label: '명칭', render: (row) => row.name },
          {
            key: 'siteId',
            label: '사업장코드',
            render: (row) => row.siteId ?? '-',
          },
        ]}
        rows={rows}
        emptyText={isLoading ? '불러오는 중…' : '조회된 창고가 없습니다.'}
      />
    </section>
  )
}
