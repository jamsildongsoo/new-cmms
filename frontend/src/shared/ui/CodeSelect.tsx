import type { ComponentProps } from 'react'
import { Select } from './Select'

// 회사별 공통코드 목록만 표시한다. 목록에서 빠진 값도 상위 폼 상태는 변경하지 않는다.
export function CodeSelect({
  options,
  value,
  ...props
}: Omit<ComponentProps<typeof Select>, 'children' | 'value'> & {
  options: readonly { value: string; label: string }[]
  value: string
}) {
  return (
    <Select {...props} value={value}>
      <option value="">선택</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}
