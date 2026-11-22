import { useState, type ComponentProps } from 'react'
import { Input } from './Input'
import { useMetadata } from '@/shared/metadata/metadata'
import { formatDecimal, validDecimalInput } from '@/shared/lib/numeric'

/** 표시만 반올림하고 원본 문자열은 보존한다. 신규 입력은 공통 자릿수를 적용한다. */
export function DecimalInput({
  kind,
  value,
  signed = false,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'type' | 'inputMode'> & {
  kind: 'quantity' | 'unitPrice'
  value: string
  signed?: boolean
}) {
  const { numericPrecision } = useMetadata()
  const [focused, setFocused] = useState(false)
  const digits = numericPrecision[kind]
  return (
    <Input
      {...props}
      type="text"
      inputMode={digits ? 'decimal' : 'numeric'}
      value={focused ? value : formatDecimal(value, digits)}
      title={value}
      onFocus={(e) => {
        setFocused(true)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        props.onBlur?.(e)
      }}
      onChange={(e) => {
        const next = e.target.value
        // 기존 고정밀 값을 지우는 편집은 허용하며 새 소수 자릿수 추가는 제한한다.
        if (
          validDecimalInput(next, digits, signed) ||
          (next.length < value.length && value.startsWith(next))
        )
          onChange?.(e)
      }}
    />
  )
}
