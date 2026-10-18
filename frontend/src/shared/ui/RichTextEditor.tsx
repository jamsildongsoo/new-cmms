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
  onChange: (value: unknown) => void
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
  if (
    typeof value === 'object' &&
    value !== null &&
    'text' in value &&
    typeof value.text === 'string'
  ) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: value.text ? [{ type: 'text', text: value.text }] : [],
        },
      ],
    }
  }
  if (typeof value === 'string') {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: value ? [{ type: 'text', text: value }] : [],
        },
      ],
    }
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

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: toEditorContent(value),
    editorProps: {
      attributes: {
        class:
          'min-h-52 border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-700',
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getJSON()),
  })

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
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Numbered list"
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
              label={`Heading ${level}`}
              active={editor.isActive('heading', { level })}
              onClick={() => chain().toggleHeading({ level }).run()}
            >
              <Icon className="h-4 w-4" />
            </ToolButton>
          )
        })}
        <select
          title="Font size"
          aria-label="Font size"
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
          label="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Insert table" onClick={addTable}>
          <Table className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Add row below"
          disabled={!inTable}
          onClick={() => chain().addRowAfter().run()}
        >
          <Rows2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Add column right"
          disabled={!inTable}
          onClick={() => chain().addColumnAfter().run()}
        >
          <Columns2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Delete row"
          disabled={!inTable}
          onClick={() => chain().deleteRow().run()}
        >
          <Table2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Merge cells"
          disabled={!editor.can().mergeCells()}
          onClick={() => chain().mergeCells().run()}
        >
          <Merge className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Split cell"
          disabled={!editor.can().splitCell()}
          onClick={() => chain().splitCell().run()}
        >
          <Split className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Delete table"
          disabled={!inTable}
          onClick={() => chain().deleteTable().run()}
        >
          <Trash2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Redo"
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
