// Approval body built from a source document at request time (a snapshot,
// not a live view). Each line becomes one paragraph in the rich-text body.
export interface ApprovalDraft {
  refModule: string
  refId: string
  title: string
  contentJson: unknown
}

export function buildSnapshot(lines: string[]): unknown {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  }
}
