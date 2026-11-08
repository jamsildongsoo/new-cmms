/** Tiptap 문서 JSON을 같은 확장으로 편집·조회하여 표와 글자 서식을 보존한다. */
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { TableKit } from '@tiptap/extension-table'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Columns2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Merge,
  Pilcrow,
  Redo2,
  Rows2,
  Split,
  Table,
  Table2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useEffect } from 'react'

interface RichTextEditorProps {
  value: unknown
  onChange?: (value: unknown) => void
  readOnly?: boolean
}

function toEditorContent(value: unknown): JSONContent {
  if (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'doc'
  ) {
    return value as JSONContent
  }
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

function ToolButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-7 w-7 items-center justify-center border text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-40',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 bg-white hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      TableKit.configure({ table: { resizable: !readOnly } }),
    ],
    content: toEditorContent(value),
    editorProps: {
      attributes: {
        class:
          'min-h-52 border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-700',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (!readOnly) onChange?.(currentEditor.getJSON())
    },
  })

  useEffect(() => {
    editor?.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor) {
      return
    }
    const current = JSON.stringify(editor.getJSON())
    const nextContent = toEditorContent(value)
    const next = JSON.stringify(nextContent)
    if (current !== next) {
      editor.commands.setContent(nextContent)
    }
  }, [editor, value])

  if (!editor) {
    return null
  }

  // 작성 화면과 같은 확장으로 JSON을 표시하되 도구 모음과 편집 기능은 제공하지 않는다.
  if (readOnly) {
    return <EditorContent editor={editor} />
  }

  const addTable = () =>
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: false })
      .run()

  const inTable = editor.isActive('table')
  const chain = () => editor.chain().focus()
  const currentSize =
    (editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <ToolButton
          label="굵게"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="기울임"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="글머리 기호"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="번호 목록"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        {([1, 2, 3] as const).map((level) => {
          const Icon = [Heading1, Heading2, Heading3][level - 1]
          return (
            <ToolButton
              key={level}
              label={`제목 ${level}`}
              active={editor.isActive('heading', { level })}
              onClick={() => chain().toggleHeading({ level }).run()}
            >
              <Icon className="h-4 w-4" />
            </ToolButton>
          )
        })}
        <select
          title="글꼴 크기"
          aria-label="글꼴 크기"
          value={currentSize}
          onChange={(event) => {
            const size = event.target.value
            if (size) chain().setFontSize(size).run()
            else chain().unsetFontSize().run()
          }}
          className="h-7 border border-slate-300 bg-white px-1 text-xs text-slate-700"
        >
          <option value="">Size</option>
          {[10, 12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
            <option key={size} value={`${size}px`}>
              {size}
            </option>
          ))}
        </select>
        <ToolButton
          label="본문"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="표 삽입" onClick={addTable}>
          <Table className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="아래 행 추가"
          disabled={!inTable}
          onClick={() => chain().addRowAfter().run()}
        >
          <Rows2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="오른쪽 열 추가"
          disabled={!inTable}
          onClick={() => chain().addColumnAfter().run()}
        >
          <Columns2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="행 삭제"
          disabled={!inTable}
          onClick={() => chain().deleteRow().run()}
        >
          <Table2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="셀 병합"
          disabled={!editor.can().mergeCells()}
          onClick={() => chain().mergeCells().run()}
        >
          <Merge className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="셀 분할"
          disabled={!editor.can().splitCell()}
          onClick={() => chain().splitCell().run()}
        >
          <Split className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="표 삭제"
          disabled={!inTable}
          onClick={() => chain().deleteTable().run()}
        >
          <Trash2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="실행 취소"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="다시 실행"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
