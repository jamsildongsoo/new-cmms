import { Node } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Table,
  Undo2,
} from 'lucide-react'
import { useEffect } from 'react'

const TableNode = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  parseHTML: () => [{ tag: 'table' }],
  renderHTML: ({ HTMLAttributes }) => ['table', HTMLAttributes, ['tbody', 0]],
})

const TableRowNode = Node.create({
  name: 'tableRow',
  content: 'tableCell+',
  parseHTML: () => [{ tag: 'tr' }],
  renderHTML: ({ HTMLAttributes }) => ['tr', HTMLAttributes, 0],
})

const TableCellNode = Node.create({
  name: 'tableCell',
  content: 'block+',
  parseHTML: () => [{ tag: 'td' }, { tag: 'th' }],
  renderHTML: ({ HTMLAttributes }) => ['td', HTMLAttributes, 0],
})

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
    extensions: [StarterKit, TableNode, TableRowNode, TableCellNode],
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

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'table',
        content: Array.from({ length: 3 }).map(() => ({
          type: 'tableRow',
          content: Array.from({ length: 3 }).map(() => ({
            type: 'tableCell',
            content: [{ type: 'paragraph' }],
          })),
        })),
      })
      .run()
  }

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
