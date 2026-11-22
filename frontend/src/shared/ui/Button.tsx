import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-blue-700 bg-blue-700 text-white hover:border-blue-800 hover:bg-blue-800',
  secondary: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger:
    'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-2',
  md: 'h-8 px-3',
  lg: 'h-10 px-4',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
