import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/shared/ui/Input'
import { toMessage } from '@/shared/api/errors'
import { searchDirectoryEquipment, searchDirectoryMaterials } from './directory.api'

type Kind = 'equipment' | 'material'
type Choice = { id: string; name: string; detail?: string }

export function ReferenceLookupInput({ kind, value, onChange }: {
  kind: Kind
  value: string
  onChange: (value: string) => void
}) {
  const [results, setResults] = useState<Choice[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [error, setError] = useState('')
  const selectedId = useRef<string | null>(null)
  const listId = useId()
  const label = kind === 'equipment' ? '설비' : '자재'

  useEffect(() => {
    const keyword = value.trim()
    if (!keyword || keyword === selectedId.current) return
    let current = true
    const timer = setTimeout(() => {
      const request = kind === 'equipment'
        ? searchDirectoryEquipment(keyword).then((rows) => rows.map((row) => ({ id: row.equipmentId, name: row.name, detail: row.siteId })))
        : searchDirectoryMaterials(keyword).then((rows) => rows.map((row) => ({ id: row.materialId, name: row.name })))
      request.then((rows) => {
        if (!current) return
        setResults(rows)
        setActive(-1)
        setOpen(true)
        setError('')
      }).catch((failure) => {
        if (current) setError(toMessage(failure))
      })
    }, 250)
    return () => { current = false; clearTimeout(timer) }
  }, [kind, value])

  const choose = (choice: Choice) => {
    selectedId.current = choice.id
    onChange(choice.id)
    setResults([])
    setOpen(false)
  }

  return <div className="relative">
    <Input role="combobox" aria-label={`${label}번호 검색`} aria-autocomplete="list"
      aria-expanded={open && Boolean(value.trim()) && results.length > 0} aria-controls={listId}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      placeholder={`${label}명 검색 후 선택 또는 번호 입력`} value={value}
      onChange={(event) => {
        selectedId.current = null
        setResults([])
        setOpen(false)
        onChange(event.target.value)
      }}
      onFocus={() => setOpen(Boolean(value.trim()) && results.length > 0)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' && results.length) {
          event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, results.length - 1))
        } else if (event.key === 'ArrowUp' && results.length) {
          event.preventDefault(); setActive((index) => Math.max(index - 1, 0))
        } else if (event.key === 'Enter' && open && active >= 0 && results[active]) {
          event.preventDefault(); choose(results[active])
        } else if (event.key === 'Escape') setOpen(false)
      }} />
    {open && Boolean(value.trim()) && results.length > 0 && <ul id={listId} role="listbox" aria-label={`${label} 후보`}
      className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white text-xs shadow-lg">
      {results.map((row, index) => <li key={row.id} id={`${listId}-${index}`} role="option"
        aria-selected={index === active} className={`cursor-pointer px-2 py-1.5 ${index === active ? 'bg-slate-100' : ''}`}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row)}>
        <span className="font-medium">{row.name}</span> <span className="text-slate-500">({row.id})</span>
        {row.detail && <span className="ml-2 text-slate-500">사업장 {row.detail}</span>}
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </div>
}
