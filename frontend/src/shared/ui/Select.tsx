import type { SelectHTMLAttributes } from 'react'

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        'h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-slate-700 disabled:bg-slate-100',
        className,
      ].join(' ')}
    />
  )
}
