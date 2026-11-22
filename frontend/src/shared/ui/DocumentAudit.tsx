import type { AuditFields } from '@/shared/types/audit'
import { formatDateTime } from '@/shared/lib/format'

export function DocumentAudit({ record }: { record: Partial<AuditFields> }) {
  const fields = [
    ['등록자', record.createdBy || '-'],
    ['등록일시', formatDateTime(record.createdAt)],
    ['수정자', record.updatedBy || '-'],
    ['수정일시', formatDateTime(record.updatedAt)],
  ]
  return (
    <details className="border-t border-slate-200 pt-3 text-xs text-slate-500">
      <summary className="cursor-pointer text-sm font-medium">
        작성·수정 정보
      </summary>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 font-medium">{label}</dt>
            <dd className="break-words text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
