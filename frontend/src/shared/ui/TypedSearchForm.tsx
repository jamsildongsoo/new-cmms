import type { FormEvent, ReactNode } from 'react'
import { Input } from './Input'
import { Select } from './Select'
import { SearchActions } from './SearchActions'
import { UserLookupInput } from '@/shared/lookup/UserLookupInput'
import { ReferenceLookupInput } from '@/shared/lookup/ReferenceLookupInput'

export type SearchOption = { value: string; label: string }

export function TypedSearchForm({ options, searchType, onSearchTypeChange, search,
  onSearchChange, onSubmit, onReset, loading, extra, referenceLookup = true }: {
  options: readonly SearchOption[]
  searchType: string
  onSearchTypeChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onReset: (event: FormEvent<HTMLFormElement>) => void
  loading?: boolean
  extra?: ReactNode
  referenceLookup?: boolean
}) {
  return <form className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-12"
    onSubmit={onSubmit} onReset={onReset}>
    <label className="min-w-0 space-y-1.5 lg:col-span-2">
      <span className="block text-sm font-medium text-slate-700">유형</span>
      <Select value={searchType} onChange={(event) => { onSearchTypeChange(event.target.value); onSearchChange('') }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
    </label>
    <label className="min-w-0 space-y-1.5 lg:col-span-8">
      <span className="block text-sm font-medium text-slate-700">검색어</span>
      {searchType === 'createdBy' || searchType === 'submitterId'
        ? <UserLookupInput value={search} onChange={onSearchChange} onSelect={(user) => onSearchChange(user.userId)} />
        : referenceLookup && searchType === 'equipmentId'
          ? <ReferenceLookupInput kind="equipment" value={search} onChange={onSearchChange} />
          : referenceLookup && searchType === 'materialId'
            ? <ReferenceLookupInput kind="material" value={search} onChange={onSearchChange} />
            : <Input aria-label="검색어" type="text" value={search} maxLength={200}
                placeholder="검색어 입력" onChange={(event) => onSearchChange(event.target.value)} />}
    </label>
    <div className="lg:col-span-2"><SearchActions loading={loading} /></div>
    {extra && <div className="lg:col-span-12">{extra}</div>}
  </form>
}
