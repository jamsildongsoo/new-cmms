import type { TextareaHTMLAttributes } from 'react'

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        'min-h-24 leading-relaxed leading-relaxed w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600',
        className,
      ].join(' ')}
    />
  )
}
