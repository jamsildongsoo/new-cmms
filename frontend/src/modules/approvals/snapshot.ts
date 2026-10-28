// Approval body built from a source document at request time (a snapshot,
// not a live view). Each source module builds its own snapshot.
export interface ApprovalDraft {
  refModule: string
  refId: string
  title: string
  contentJson: unknown
}

type Node = Record<string, unknown>

const text = (value: string): Node[] =>
  value ? [{ type: 'text', text: value }] : []

const paragraph = (value: string): Node => ({
  type: 'paragraph',
  content: text(value),
})

const cell = (value: string): Node => ({
  type: 'tableCell',
  content: [paragraph(value)],
})

export function buildFieldTable(fields: [string, string | null | undefined][]) {
  return {
    type: 'table',
    content: fields.map(([label, value]) => ({
      type: 'tableRow',
      content: [cell(label), cell(value || '-')],
    })),
  }
}

export function buildSnapshot(options: {
  fields: [string, string | null | undefined][]
  content?: string | null
}): unknown {
  const nodes: Node[] = [buildFieldTable(options.fields)]
  if (options.content) {
    nodes.push(paragraph('Content'))
    nodes.push(...options.content.split('\n').map(paragraph))
  }
  return { type: 'doc', content: nodes }
}
