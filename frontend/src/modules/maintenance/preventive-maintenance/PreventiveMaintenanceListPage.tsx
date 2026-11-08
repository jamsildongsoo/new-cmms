import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dateInput, isInspectionOverdue } from '@/modules/maintenance/equipment'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import {
  getPreventiveMaintenanceList,
  type PreventiveMaintenance,
} from './preventiveMaintenance.api'

export function PreventiveMaintenanceListPage() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<PreventiveMaintenance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('preventive_maintenance:create')

  useEffect(() => {
    let active = true
    getPreventiveMaintenanceList()
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">예방점검</div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() =>
              printDocument({
                title: '예방정비 목록',
                columns: [
                  '문서번호',
                  '관리번호',
                  '제목',
                  '설비',
                  '점검일',
                  '다음 점검일',
                  '판정',
                  '점검부서',
                  '점검자',
                  '상태',
                ],
                rows: rows.map((row) => [
                  row.pmId,
                  row.documentNo,
                  row.title,
                  row.equipmentId,
                  dateInput(row.inspectionDate),
                  dateInput(row.nextInspectionDate),
                  row.result ?? '',
                  row.inspectionDeptName || row.inspectionDeptId || '',
                  row.inspectorName || row.inspectorId || '',
                  row.status,
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            onClick={() => navigate('/preventive-maintenance/new')}
            disabled={!canCreate}
          >
            신규
          </Button>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <DataTable
            gridTemplateColumns="190px 120px minmax(160px,1fr) 120px 110px 160px 70px 120px 120px 70px"
            rows={rows}
            emptyText={isLoading ? '조회 중...' : '등록된 점검이 없습니다.'}
            columns={[
              {
                key: 'systemDocumentId',
                label: '문서번호',
                render: (r) => r.pmId,
              },
              {
                key: 'documentNo',
                label: '관리번호',
                render: (r) => r.documentNo,
              },
              {
                key: 'title',
                label: '점검명',
                render: (r) => (
                  <Link
                    className="text-blue-700 underline"
                    to={`/preventive-maintenance/${r.pmId}`}
                  >
                    {r.title}
                  </Link>
                ),
              },
              {
                key: 'equipmentId',
                label: '설비',
                render: (r) => r.equipmentId,
              },
              {
                key: 'inspectionDate',
                label: '점검일',
                render: (r) => dateInput(r.inspectionDate),
              },
              {
                key: 'nextInspectionDate',
                label: '다음 점검일',
                render: (r) => (
                  <span
                    className={
                      isInspectionOverdue(r.nextInspectionDate)
                        ? 'rounded bg-red-50 px-1 font-semibold text-red-700'
                        : ''
                    }
                  >
                    {dateInput(r.nextInspectionDate)}
                    {isInspectionOverdue(r.nextInspectionDate) &&
                      ' (기한 경과)'}
                  </span>
                ),
              },
              { key: 'result', label: '판정', render: (r) => r.result || '' },
              {
                key: 'inspectionDeptId',
                label: '점검부서',
                render: (r) => r.inspectionDeptName || r.inspectionDeptId || '',
              },
              {
                key: 'inspectorId',
                label: '점검자',
                render: (r) => r.inspectorName || r.inspectorId || '',
              },
              {
                key: 'status',
                label: '상태',
                render: (r) => <StatusBadge status={r.status} />,
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
