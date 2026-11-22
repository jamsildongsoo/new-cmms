import type { ReactNode } from 'react'

interface DataTableColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  align?: 'left' | 'center' | 'right'
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
  emptyText = '조회된 내역이 없습니다.',
}: DataTableProps<T>) {
  const alignment = (column: DataTableColumn<T>) => {
    const align =
      column.align ??
      (/^(status|stepNo|sequence|deleteYn|useYn)$/.test(column.key)
        ? 'center'
        : /(quantity|qty|amount|price|cost|balance|stock|quantityChange|amountChange)$/i.test(
              column.key,
            )
          ? 'right'
          : 'left')
    return align === 'right'
      ? 'text-right tabular-nums'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  }
  return (
    <div
      className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
      role="region"
      aria-label="조회 결과"
      tabIndex={0}
    >
      <div role="table" style={{ minWidth: columns.length * 110 }}>
        <div
          role="row"
          className="grid items-center border-b border-slate-200 bg-slate-50"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={`px-3 py-2.5 text-sm font-semibold text-slate-700 ${alignment(column)}`}
            >
              {column.label}
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <div
            role="status"
            className="px-3 py-8 text-center text-xs text-slate-500"
          >
            {emptyText}
          </div>
        ) : (
          rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              role="row"
              className="grid items-center border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40"
              style={{ gridTemplateColumns }}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  role="cell"
                  className={`min-w-0 break-words px-3 py-2.5 text-xs text-slate-700 ${alignment(column)}`}
                >
                  {column.render(row)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
