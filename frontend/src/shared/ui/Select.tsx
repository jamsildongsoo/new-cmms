import type { SelectHTMLAttributes } from 'react'

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600',
        className,
      ].join(' ')}
    />
  )
}
