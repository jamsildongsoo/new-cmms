import { Input } from './Input'

/** 시스템 문서 ID와 사용자가 입력하는 관리번호를 구분한다. */
export function DocumentIdField({ value }: { value?: string | null }) {
  return (
    <label className="block space-y-1 text-xs text-slate-600">
      <span>문서번호</span>
      <Input
        value={value ?? ''}
        placeholder="저장 시 자동 생성"
        readOnly
        aria-label="문서번호"
      />
    </label>
  )
}
