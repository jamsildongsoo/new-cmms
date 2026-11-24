import { useEffect, useId, useRef, useState } from 'react'
import { toMessage } from '@/shared/api/errors'
import { Input } from '@/shared/ui/Input'
import { searchDirectoryUsers, type DirectoryUser } from './directory.api'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (user: DirectoryUser) => void
}

/** 이름·ID 후보를 보여주고 선택한 사용자의 ID를 검색어로 확정한다. */
export function UserLookupInput({ value, onChange, onSelect }: Props) {
  const [results, setResults] = useState<DirectoryUser[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const selectedId = useRef<string | null>(null)
  const listId = useId()

  useEffect(() => {
    const keyword = value.trim()
    if (!keyword || keyword === selectedId.current) return
    let current = true
    const timer = setTimeout(() => {
      searchDirectoryUsers(keyword)
        .then((users) => {
          if (!current) return
          setResults(users)
          setActive(-1)
          setError(null)
          setOpen(true)
        })
        .catch((failure) => {
          if (current) setError(toMessage(failure))
        })
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [value])

  const choose = (user: DirectoryUser) => {
    selectedId.current = user.userId
    onSelect(user)
    setResults([])
    setOpen(false)
    setError(null)
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-label="작성자 검색"
        aria-autocomplete="list"
        aria-expanded={open && Boolean(results.length)}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 && results[active] ? `${listId}-${active}` : undefined}
        value={value}
        placeholder="이름 검색 후 선택 또는 ID 입력"
        onChange={(event) => {
          selectedId.current = null
          setResults([])
          setOpen(false)
          setError(null)
          onChange(event.target.value)
        }}
        onFocus={() => setOpen(Boolean(value.trim()) && results.length > 0)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && results.length) {
            event.preventDefault()
            setOpen(true)
            setActive((index) => Math.min(index + 1, results.length - 1))
          } else if (event.key === 'ArrowUp' && results.length) {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter' && open && active >= 0 && results[active]) {
            event.preventDefault()
            choose(results[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" aria-label="작성자 후보" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white text-xs shadow-lg">
          {results.map((user, index) => (
            <li
              key={user.userId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`cursor-pointer px-2 py-1.5 ${index === active ? 'bg-slate-100' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(user)}
            >
              <span className="font-medium text-slate-900">{user.userName}</span>{' '}
              <span className="text-slate-500">({user.userId})</span>
              <span className="ml-2 text-slate-500">
                {[user.deptName, user.title, user.position].filter(Boolean).join(' / ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  )
}
