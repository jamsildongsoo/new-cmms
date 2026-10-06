import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700',
  secondary: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'border-red-600 bg-red-600 text-white hover:bg-red-500',
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
        'inline-flex items-center justify-center gap-1.5 border text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
