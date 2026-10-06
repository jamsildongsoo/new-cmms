import type { InputHTMLAttributes } from 'react'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'h-8 w-full border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700 disabled:bg-slate-100',
        className,
      ].join(' ')}
    />
  )
}
