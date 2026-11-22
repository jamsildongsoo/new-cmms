import { Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'

interface DocumentIdFieldProps {
  value?: string | null
  documentNo?: string | null
  onDocumentNoChange?: (value: string) => void
  disabled?: boolean
  readOnly?: boolean
}

/** 자동 문서번호와 선택 입력 관리번호를 한 메타정보 영역에 표시한다. */
export function DocumentIdField({
  value,
  documentNo,
  onDocumentNoChange,
  disabled = false,
  readOnly = false,
}: DocumentIdFieldProps) {
  const [notice, setNotice] = useState('')
  const copy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setNotice('문서번호를 복사했습니다.')
    } catch {
      setNotice('복사하지 못했습니다. 문서번호를 선택해 복사해 주세요.')
    }
  }
  return (
    <div className="document-meta">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-medium">문서번호</span>
        <span className="select-all break-all font-medium text-slate-900">
          {value || '저장 시 자동 생성'}
        </span>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="문서번호 복사"
            title="문서번호 복사"
            onClick={() => void copy()}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {onDocumentNoChange && !readOnly ? (
        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="shrink-0 font-medium">관리번호</span>
          <Input
            aria-label="관리번호"
            className="sm:w-56"
            value={documentNo ?? ''}
            maxLength={50}
            placeholder="선택 입력"
            disabled={disabled}
            onChange={(event) => onDocumentNoChange(event.target.value)}
          />
        </label>
      ) : documentNo ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-medium">관리번호</span>
          <span className="break-all text-slate-900">{documentNo}</span>
        </div>
      ) : null}
      <span role="status" className={notice ? 'w-full text-xs' : 'sr-only'}>
        {notice}
      </span>
    </div>
  )
}

/** 목록에서는 두 번호를 한 열에 묶고 빈 관리번호는 생략한다. */
export function DocumentNumber({
  value,
  documentNo,
}: Pick<DocumentIdFieldProps, 'value' | 'documentNo'>) {
  return (
    <div className="min-w-0 break-all">
      <div className="font-medium text-slate-800">{value || '-'}</div>
      {documentNo && (
        <div className="mt-0.5 text-xs text-slate-500">{documentNo}</div>
      )}
    </div>
  )
}
