import { Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAttachment,
  deleteAttachmentItem,
  downloadAttachmentItem,
  getAttachmentItems,
  uploadAttachmentItems,
  type AttachmentItem,
} from '../api/attachments.api'
import { Button } from './ui/Button'

interface AttachmentManagerProps {
  attachmentId: string | null
  refModule: string
  refId: string
  disabled?: boolean
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

export function AttachmentManager({
  attachmentId,
  refModule,
  refId,
  disabled = false,
  onAttachmentIdChange,
  onError,
}: AttachmentManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [isBusy, setIsBusy] = useState(false)

  const loadItems = useCallback(async (targetAttachmentId = attachmentId) => {
    if (!targetAttachmentId) {
      setItems([])
      return
    }
    try {
      setItems(await getAttachmentItems(targetAttachmentId))
    } catch {
      onError('Failed to load attachments')
    }
  }, [attachmentId, onError])

  useEffect(() => {
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

  const ensureAttachmentId = async () => {
    if (attachmentId) {
      return attachmentId
    }
    const attachment = await createAttachment(refModule, refId)
    onAttachmentIdChange(attachment.attachmentId)
    return attachment.attachmentId
  }

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return
    }
    setIsBusy(true)
    try {
      const nextAttachmentId = await ensureAttachmentId()
      await uploadAttachmentItems(nextAttachmentId, files)
      await loadItems(nextAttachmentId)
    } catch {
      onError('Failed to upload attachment')
    } finally {
      setIsBusy(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const downloadItem = async (item: AttachmentItem) => {
    setIsBusy(true)
    try {
      const blob = await downloadAttachmentItem(item.attachmentId, item.itemNo)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.originalName
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      onError('Failed to download attachment')
    } finally {
      setIsBusy(false)
    }
  }

  const removeItem = async (itemNo: number) => {
    if (!attachmentId) {
      return
    }
    setIsBusy(true)
    try {
      await deleteAttachmentItem(attachmentId, itemNo)
      await loadItems()
    } catch {
      onError('Failed to delete attachment')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
          <Paperclip className="h-4 w-4" />
          Attachments
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || isBusy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>
      <div className="grid gap-1">
        {items.length === 0 ? (
          <div className="border border-dashed border-slate-200 px-2 py-3 text-center text-xs text-slate-500">
            No attachments
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
                onClick={() => void downloadItem(item)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || isBusy}
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
