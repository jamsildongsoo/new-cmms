import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { toMessage } from '@/shared/api/errors'
import { getEquipmentTree, type Equipment } from './equipment.api'

function excludedEquipment(items: Equipment[], id: string) {
  const excluded = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    for (const item of items)
      if (
        item.parentEquipmentId &&
        excluded.has(item.parentEquipmentId) &&
        !excluded.has(item.equipmentId)
      ) {
        excluded.add(item.equipmentId)
        changed = true
      }
  }
  return excluded
}
export function EquipmentTree({
  items,
  search = '',
  selected = '',
  excluded = new Set<string>(),
  onSelect,
}: {
  items: Equipment[]
  search?: string
  selected?: string
  excluded?: Set<string>
  onSelect?: (id: string) => void
}) {
  const byId = new Map(items.map((i) => [i.equipmentId, i]))
  const visible = new Set<string>()
  const term = search.trim().toLocaleLowerCase()
  for (const item of items)
    if (
      !term ||
      `${item.equipmentId} ${item.name}`.toLocaleLowerCase().includes(term)
    ) {
      let current: Equipment | undefined = item
      const visited = new Set<string>()
      while (current && !visited.has(current.equipmentId)) {
        visited.add(current.equipmentId)
        visible.add(current.equipmentId)
        current = current.parentEquipmentId
          ? byId.get(current.parentEquipmentId)
          : undefined
      }
    }
  const children = new Map<string, Equipment[]>()
  for (const item of items) {
    const key =
      item.parentEquipmentId && byId.has(item.parentEquipmentId)
        ? item.parentEquipmentId
        : ''
    children.set(key, [...(children.get(key) ?? []), item])
  }
  const render = (item: Equipment, path: Set<string>) => {
    if (path.has(item.equipmentId) || !visible.has(item.equipmentId))
      return null
    const next = new Set(path).add(item.equipmentId),
      nested = (children.get(item.equipmentId) ?? []).filter(
        (i) => !next.has(i.equipmentId) && visible.has(i.equipmentId),
      )
    const label = (
      <span>
        {item.equipmentId} / {item.name}
      </span>
    )
    const content = (
      <span className="inline-flex items-center gap-2 py-1">
        {onSelect ? (
          label
        ) : (
          <Link
            className="text-blue-700 underline"
            to={`/equipment/${encodeURIComponent(item.equipmentId)}`}
          >
            {label}
          </Link>
        )}
        {onSelect && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`${item.equipmentId} 상위 설비 선택`}
            disabled={excluded.has(item.equipmentId)}
            onClick={(e) => {
              e.preventDefault()
              onSelect(item.equipmentId)
            }}
          >
            {selected === item.equipmentId ? '선택됨' : '선택'}
          </Button>
        )}
      </span>
    )
    return (
      <li
        key={item.equipmentId}
        role="treeitem"
        aria-selected={selected === item.equipmentId}
        className="pl-3 text-xs"
      >
        {nested.length ? (
          <details open>
            <summary>{content}</summary>
            <ul role="group">{nested.map((child) => render(child, next))}</ul>
          </details>
        ) : (
          content
        )}
      </li>
    )
  }
  const roots = (children.get('') ?? []).filter((i) =>
    visible.has(i.equipmentId),
  )
  return roots.length ? (
    <ul role="tree" aria-label="설비 트리">
      {roots.map((item) => render(item, new Set()))}
    </ul>
  ) : (
    <p className="p-2 text-xs text-slate-500">표시할 설비가 없습니다.</p>
  )
}
export function ParentEquipmentSelect({
  siteId,
  equipmentId,
  value,
  onChange,
  disabled,
}: {
  siteId: string
  equipmentId: string
  value: string
  onChange: (id: string) => void
  disabled: boolean
}) {
  const [opened, setOpened] = useState(false),
    [search, setSearch] = useState(''),
    [loaded, setLoaded] = useState<{ siteId: string; items: Equipment[] }>({
      siteId: '',
      items: [],
    }),
    [error, setError] = useState<{ siteId: string; message: string } | null>(
      null,
    )
  useEffect(() => {
    if (!siteId) return
    let active = true
    getEquipmentTree(siteId)
      .then((items) => active && setLoaded({ siteId, items }))
      .catch((e) => active && setError({ siteId, message: toMessage(e) }))
    return () => {
      active = false
    }
  }, [siteId])
  const items = loaded.siteId === siteId ? loaded.items : [],
    parent = items.find((i) => i.equipmentId === value)
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          aria-label="선택한 상위 설비"
          readOnly
          value={
            parent
              ? `${parent.equipmentId} / ${parent.name}`
              : value || '최상위 설비'
          }
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !siteId}
          onClick={() => setOpened((v) => !v)}
        >
          트리 선택
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !value}
          onClick={() => onChange('')}
        >
          선택 해제
        </Button>
      </div>
      {value && (
        <Link
          className="text-xs text-blue-700 underline"
          to={`/equipment/${encodeURIComponent(value)}`}
        >
          상위 설비 조회
        </Link>
      )}
      {opened && !disabled && (
        <div className="space-y-2 border p-2">
          <Input
            aria-label="상위 설비 검색"
            placeholder="설비번호 또는 설비명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {error?.siteId === siteId && <p role="alert">{error.message}</p>}
          {loaded.siteId !== siteId ? (
            <p>조회 중...</p>
          ) : (
            <EquipmentTree
              items={items}
              search={search}
              selected={value}
              excluded={excludedEquipment(items, equipmentId)}
              onSelect={(id) => {
                onChange(id)
                setOpened(false)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function ChildEquipmentList({
  siteId,
  equipmentId,
}: {
  siteId: string
  equipmentId: string
}) {
  const [rows, setRows] = useState<Equipment[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getEquipmentTree(siteId)
      .then(
        (items) =>
          active &&
          setRows(items.filter((i) => i.parentEquipmentId === equipmentId)),
      )
      .catch((e) => active && setError(toMessage(e)))
    return () => {
      active = false
    }
  }, [siteId, equipmentId])
  return (
    <section className="space-y-2 border bg-white p-3">
      <h2 className="text-sm font-semibold">하위 설비</h2>
      {error && <p role="alert">{error}</p>}
      {rows.length ? (
        <ul className="space-y-1 text-xs">
          {rows.map((row) => (
            <li key={row.equipmentId}>
              <Link
                className="text-blue-700 underline"
                to={`/equipment/${encodeURIComponent(row.equipmentId)}`}
              >
                {row.equipmentId} / {row.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">하위 설비가 없습니다.</p>
      )}
    </section>
  )
}
