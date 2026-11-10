import { DataTable } from '@/shared/ui/DataTable'
import type { ReportRow } from './report.types'
export type ReportColumn = [string, string]
export function ReportTable({
  title,
  rows,
  columns,
}: {
  title: string
  rows: ReportRow[]
  columns: ReportColumn[]
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <div style={{ minWidth: columns.length * 110 }}>
          <DataTable<ReportRow>
            rows={rows}
            emptyText="조회된 내역이 없습니다."
            gridTemplateColumns={columns
              .map(() => 'minmax(100px,1fr)')
              .join(' ')}
            columns={columns.map(([key, label]) => ({
              key,
              label,
              render: (r) => String(r[key] ?? ''),
            }))}
          />
        </div>
      </div>
    </section>
  )
}
