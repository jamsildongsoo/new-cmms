import type { TextareaHTMLAttributes } from 'react'

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'min-h-24 w-full border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700 disabled:bg-slate-100',
        className,
      ].join(' ')}
    />
  )
}
