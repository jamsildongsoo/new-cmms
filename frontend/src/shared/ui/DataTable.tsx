import type { ReactNode } from 'react'

interface DataTableColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  gridTemplateColumns: string
  emptyText?: string
}

export function DataTable<T>({
  columns,
  rows,
  gridTemplateColumns,
  emptyText = 'No data',
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden border border-slate-200 bg-white">
      <div
        className="grid border-b border-slate-200 bg-slate-50"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-3 py-2 text-xs font-semibold text-slate-600"
          >
            {column.label}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-slate-500">
          {emptyText}
        </div>
      ) : (
        rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
            style={{ gridTemplateColumns }}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className="min-w-0 px-3 py-2 text-xs text-slate-700"
              >
                {column.render(row)}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
