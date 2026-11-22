// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { printDocument } from '@/shared/lib/print'
import { toMessage } from '@/shared/api/errors'
import { getDepartments, type Department } from './departments.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'

export function DepartmentListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('DEPT:create')

  useEffect(() => {
    let active = true
    getDepartments()
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
          <h1 className="text-lg font-semibold text-slate-900">부서 관리</h1>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() =>
              printDocument({
                title: '부서 목록',
                columns: ['코드', '명칭', '상위부서'],
                rows: rows.map((row) => [
                  row.deptId,
                  row.name,
                  row.parentDeptId,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            onClick={() => navigate('/departments/new')}
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

      <DataTable<Department>
        gridTemplateColumns="1fr 1fr 1fr"
        columns={[
          {
            key: 'deptId',
            label: '부서코드',
            render: (row) => (
              <Link
                className="text-blue-700 underline"
                to={`/departments/${encodeURIComponent(row.deptId)}`}
              >
                {row.deptId}
              </Link>
            ),
          },
          { key: 'name', label: '명칭', render: (row) => row.name },
          {
            key: 'parentDeptId',
            label: '상위 항목',
            render: (row) => row.parentDeptId ?? '-',
          },
        ]}
        rows={rows}
        emptyText={isLoading ? '불러오는 중…' : '조회된 부서가 없습니다.'}
      />
    </section>
  )
}
