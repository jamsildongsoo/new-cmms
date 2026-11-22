// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { Button } from '@/shared/ui/Button'
import { printDocument } from '@/shared/lib/print'
import { DataTable } from '@/shared/ui/DataTable'
import { listRecords, type IdentityRow, type Resource } from './identity.api'
import { configs } from './identityConfig'

export function IdentityListPage({ resource }: { resource: Resource }) {
  const config = configs[resource]
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<IdentityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listRecords(resource)
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [resource])

  const columns = [
    {
      key: 'id',
      label: config.fields[0].label,
      render: (row: IdentityRow) => (
        <Link
          className="text-blue-700 underline"
          to={`/${resource}/${encodeURIComponent(String(row[config.idKey]))}`}
        >
          {String(row[config.idKey])}
        </Link>
      ),
    },
    {
      key: 'name',
      label: '명칭',
      render: (row: IdentityRow) => String(row.name ?? ''),
    },
    ...(resource === 'users'
      ? [
          {
            key: 'site',
            label: '사업장',
            render: (row: IdentityRow) => String(row.siteName || ''),
          },
          {
            key: 'department',
            label: '부서',
            render: (row: IdentityRow) => String(row.deptName || ''),
          },
        ]
      : []),
  ]
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between">
        <h1 className="text-lg font-semibold">{config.title}</h1>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() =>
              printDocument({
                title: `${config.title} 목록`,
                columns:
                  resource === 'users'
                    ? [config.fields[0].label, '명칭', '사업장', '부서']
                    : [config.fields[0].label, '명칭'],
                rows: rows.map((row) =>
                  resource === 'users'
                    ? [
                        String(row[config.idKey]),
                        String(row.name ?? ''),
                        String(row.siteName || row.siteId || ''),
                        String(row.deptName || row.deptId || ''),
                      ]
                    : [String(row[config.idKey]), String(row.name ?? '')],
                ),
              })
            }
          >
            인쇄
          </Button>
          <Button
            disabled={!hasPermission(`${config.permission}:create`)}
            onClick={() => navigate(`/${resource}/new`)}
          >
            신규 작성
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <DataTable
        rows={rows}
        columns={columns}
        gridTemplateColumns={
          resource === 'users' ? '140px 1fr 1fr 1fr' : '180px 1fr'
        }
        emptyText={loading ? '불러오는 중…' : '조회된 내역이 없습니다.'}
      />
    </section>
  )
}
