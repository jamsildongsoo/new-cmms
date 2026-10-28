import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { toMessage } from '@/shared/api/errors'
import { Input } from '@/shared/ui/Input'
import { searchApprovalUsers, type ApprovalUserInfo } from './approvals.api'

interface UserSearchBoxProps {
  placeholder: string
  excludeUserIds: string[]
  onSelect: (user: ApprovalUserInfo) => void
  onError: (message: string | null) => void
}

const describe = (user: ApprovalUserInfo) =>
  [user.deptName, user.title, user.position].filter(Boolean).join(' / ')

export function UserSearchBox({
  placeholder,
  excludeUserIds,
  onSelect,
  onError,
}: UserSearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ApprovalUserInfo[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    const keyword = query.trim()
    if (!keyword) {
      return
    }
    const current = ++requestId.current
    const timer = setTimeout(() => {
      searchApprovalUsers(keyword)
        .then((users) => {
          if (current === requestId.current) {
            setResults(users)
            setActive(0)
            setOpen(true)
          }
        })
        .catch((error) => onError(toMessage(error)))
    }, 250)
    return () => clearTimeout(timer)
  }, [query, onError])

  const visible = query.trim()
    ? results.filter((user) => !excludeUserIds.includes(user.userId))
    : []

  const choose = (user: ApprovalUserInfo) => {
    onSelect(user)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
      <Input
        className="pl-8"
        value={query}
        placeholder={placeholder}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((index) => Math.min(index + 1, visible.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            if (visible[active]) choose(visible[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && query.trim() && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto border border-slate-300 bg-white text-xs shadow">
          {visible.length === 0 && (
            <li className="px-2 py-1.5 text-slate-500">No matching user</li>
          )}
          {visible.map((user, index) => (
            <li
              key={user.userId}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(user)
              }}
              className={[
                'cursor-pointer px-2 py-1.5',
                index === active ? 'bg-slate-100' : '',
              ].join(' ')}
            >
              <span className="font-medium text-slate-900">
                {user.userName}
              </span>{' '}
              <span className="text-slate-500">({user.userId})</span>
              <span className="ml-2 text-slate-500">{describe(user)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
