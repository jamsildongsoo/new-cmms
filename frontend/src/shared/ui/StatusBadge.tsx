import { documentStatusLabels } from '@/shared/types/document'
import type { DocumentStatus } from '@/shared/types/document'

const statusClasses: Record<DocumentStatus, string> = {
  D: 'border-slate-300 bg-slate-50 text-slate-600',
  P: 'border-blue-200 bg-blue-50 text-blue-700',
  C: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  R: 'border-red-200 bg-red-50 text-red-700',
  X: 'border-amber-200 bg-amber-50 text-amber-700',
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={[
        'inline-block border px-1.5 py-0.5 text-[11px] font-medium',
        statusClasses[status],
      ].join(' ')}
    >
      {documentStatusLabels[status]}
    </span>
  )
}
