/** 문서 저장 전 첨부는 null 참조 UUID 그룹에 즉시 업로드하고 처리 중 부모 저장을 차단한다. */
import { Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAttachment,
  deleteAttachmentItem,
  downloadAttachmentItem,
  getAttachmentItems,
  uploadAttachmentItems,
  type AttachmentItem,
} from './attachments.api'
import { Button } from '@/shared/ui/Button'

interface AttachmentManagerProps {
  attachmentId: string | null
  refModule: string
  refId?: string | null
  /** 조회 모드에서는 추가·삭제만 막고 목록 조회와 다운로드는 허용한다. */
  disabled?: boolean
  /** 부모 화면은 첨부 처리 중 저장·상신을 차단하는 데 사용한다. */
  onBusyChange?: (isBusy: boolean) => void
  /** 새 첨부 그룹 ID를 부모 폼에 전달해 문서 저장 시 연결한다. */
  onAttachmentIdChange: (attachmentId: string) => void
  onError: (message: string) => void
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 업무 문서에서 사용하는 공통 첨부 영역.
 * 파일 선택·삭제는 문서 저장과 별개로 즉시 서버에 반영한다.
 * 첨부가 없어도 영역을 유지하고 빈 목록을 표시한다.
 */
export function AttachmentManager({
  attachmentId,
  refModule,
  refId = null,
  disabled = false,
  onBusyChange,
  onAttachmentIdChange,
  onError,
}: AttachmentManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  // 파일 본문을 임시 보관하지 않고 서버에 저장된 파일의 메타데이터만 관리한다.
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [isBusy, setIsBusy] = useState(false)

  const changeBusy = (busy: boolean) => {
    setIsBusy(busy)
    onBusyChange?.(busy)
  }

  const loadItems = useCallback(
    async (targetAttachmentId = attachmentId) => {
      if (!targetAttachmentId) {
        setItems([])
        return
      }
      try {
        setItems(await getAttachmentItems(targetAttachmentId))
      } catch {
        onError('Failed to load attachments')
      }
    },
    [attachmentId, onError],
  )

  useEffect(() => {
    // 화면이 제거되거나 조회 대상이 바뀐 뒤 도착한 이전 응답은 반영하지 않는다.
    let active = true
    if (!attachmentId) {
      return
    }
    getAttachmentItems(attachmentId)
      .then((data) => active && setItems(data))
      .catch(() => active && onError('Failed to load attachments'))
    return () => {
      active = false
    }
  }, [attachmentId, onError])

  // 최초 파일 선택 시에만 그룹을 생성한다. 저장 전에는 refId=null이며 문서 저장 후 서버에서 연결한다.
  const ensureAttachmentId = async () => {
    if (attachmentId) {
      return attachmentId
    }
    const attachment = await createAttachment(refModule, refId)
    onAttachmentIdChange(attachment.attachmentId)
    return attachment.attachmentId
  }

  const uploadFiles = async (files: FileList | null) => {
    if (disabled || isBusy || !files || files.length === 0) {
      return
    }
    changeBusy(true)
    try {
      // 그룹 생성부터 업로드·목록 갱신까지 부모의 저장·상신 차단 상태를 유지한다.
      const nextAttachmentId = await ensureAttachmentId()
      await uploadAttachmentItems(nextAttachmentId, files)
      await loadItems(nextAttachmentId)
    } catch {
      onError('Failed to upload attachment')
    } finally {
      changeBusy(false)
      if (inputRef.current) {
        // 동일한 파일을 다시 선택해도 change 이벤트가 발생하도록 입력값을 비운다.
        inputRef.current.value = ''
      }
    }
  }

  const downloadItem = async (item: AttachmentItem) => {
    if (isBusy) {
      return
    }
    changeBusy(true)
    try {
      const blob = await downloadAttachmentItem(item.attachmentId, item.itemNo)
      // 인증된 API로 받은 파일을 원본 파일명으로 내려받고 임시 URL을 해제한다.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      onError('Failed to download attachment')
    } finally {
      changeBusy(false)
    }
  }

  const removeItem = async (itemNo: number) => {
    if (disabled || isBusy || !attachmentId) {
      return
    }
    changeBusy(true)
    try {
      // 삭제는 즉시 확정되므로 부모 화면에서 취소해도 파일이 복구되지 않는다.
      await deleteAttachmentItem(attachmentId, itemNo)
      await loadItems()
    } catch {
      onError('Failed to delete attachment')
    } finally {
      changeBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled || isBusy}
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
          <Paperclip className="h-4 w-4" />
          첨부파일
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || isBusy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          파일추가
        </Button>
      </div>
      <div className="grid gap-1">
        {items.length === 0 ? (
          <div className="border border-dashed border-slate-200 px-2 py-3 text-center text-xs text-slate-500">
            첨부파일이 없습니다
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.itemNo}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border border-slate-100 px-2 py-1 text-xs"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">
                  {item.originalName}
                </div>
                <div className="text-slate-500">{formatBytes(item.size)}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isBusy}
                aria-label={`${item.originalName} 다운로드`}
                onClick={() => void downloadItem(item)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || isBusy}
                aria-label={`${item.originalName} 삭제`}
                onClick={() => void removeItem(item.itemNo)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
