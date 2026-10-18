import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({
  label,
  required = false,
  className = '',
  children,
}: FieldProps) {
  return (
    <label className={['block', className].join(' ')}>
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
    </label>
  )
}
