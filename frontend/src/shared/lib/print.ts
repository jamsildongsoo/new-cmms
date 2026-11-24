import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'

type Cell = string | number | boolean | null | undefined
interface PrintOptions {
  title: string
  landscape?: boolean
  columns?: string[]
  rows?: Cell[][]
  fields?: [string, Cell][]
  htmlBeforeContent?: string
  htmlAfterContent?: string
  contentJson?: unknown
  text?: string | null
}

function escape(value: Cell) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  )
}

// 화면의 메뉴·버튼 대신 별도 출력 양식을 만들어 인쇄한다.
export function printDocument(options: PrintOptions) {
  const frame = document.createElement('iframe')
  frame.title = `${options.title} 인쇄`
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1000px;height:1px;border:0'
  document.body.appendChild(frame)
  const target = frame.contentDocument
  if (!target) {
    frame.remove()
    return
  }
  let body = options.fields?.length
    ? `<dl>${options.fields.map(([name, value]) => `<dt>${escape(name)}</dt><dd>${escape(value) || '-'}</dd>`).join('')}</dl>`
    : ''
  if (options.columns)
    body += `<table><thead><tr>${options.columns.map((name) => `<th>${escape(name)}</th>`).join('')}</tr></thead><tbody>${(options.rows ?? []).map((row) => `<tr>${row.map((value) => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  if (options.text) body += `<p class="text">${escape(options.text)}</p>`
  if (options.htmlBeforeContent) body += options.htmlBeforeContent
  if (options.contentJson && typeof options.contentJson === 'object') {
    const markup = generateHTML(options.contentJson, [
      StarterKit,
      TextStyle,
      FontSize,
      TableKit,
    ])
    const container = document.createElement('div')
    container.innerHTML = markup
    container.querySelectorAll('a').forEach((link) => {
      if (
        !/^(https?:|mailto:|tel:|#|\/)/i.test(link.getAttribute('href') ?? '')
      )
        link.removeAttribute('href')
    })
    body += container.innerHTML
  }
  if (options.htmlAfterContent) body += options.htmlAfterContent
  target.open()
  target.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escape(options.title)}</title><style>
    @page{size:A4 ${options.landscape ? 'landscape' : 'portrait'};margin:16mm}body{font-family:Arial,"Malgun Gothic",sans-serif;color:#111;font-size:11px}h1{font-size:20px}h2{font-size:14px;margin:24px 0 8px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #999;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}thead{display:table-header-group}tr{break-inside:avoid}dl{display:grid;grid-template-columns:130px 1fr}dt,dd{margin:0;padding:5px;border-bottom:1px solid #ddd;white-space:pre-wrap}.text{white-space:pre-wrap}p{line-height:1.6}
    </style></head><body><h1>${escape(options.title)}</h1>${body}</body></html>`)
  target.close()
  const cleanup = () => frame.remove()
  frame.contentWindow?.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
  }, 100)
}
