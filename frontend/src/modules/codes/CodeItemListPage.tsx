import { Edit3, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import { deleteCodeItem, getCodeItems, type CodeItem } from './codes.api'
import { useAuth } from '../auth/useAuth'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'
import { Field } from '@/shared/ui/Field'
import { Select } from '@/shared/ui/Select'
import { CODES, isCodeId } from '@/shared/constants/code'

export function CodeItemListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const queryCodeId = searchParams.get('codeId')
  const codeId = isCodeId(queryCodeId) ? queryCodeId : CODES[0].codeId

  const [rows, setRows] = useState<CodeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('code:create')
  const canUpdate = hasPermission('code:update')
  const canDelete = hasPermission('code:delete')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setRows(await getCodeItems(codeId))
    } catch (loadError) {
      setError(toMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [codeId])

  useEffect(() => {
    let active = true
    getCodeItems(codeId)
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [codeId])

  const itemPath = (row: CodeItem) =>
    `/code-items/${row.codeId}/${encodeURIComponent(row.codeItemId)}`

  const removeRow = async (row: CodeItem) => {
    if (!window.confirm(`Delete code item ${row.codeItemId}?`)) {
      return
    }
    try {
      await deleteCodeItem(row.codeId, row.codeItemId)
      await load()
    } catch (deleteError) {
      setError(toMessage(deleteError))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Code Items</h1>
          <p className="text-xs text-slate-500">Items of the selected code</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => navigate(`/code-items/new?codeId=${codeId}`)}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      <Field label="Code" className="max-w-sm">
        <Select
          value={codeId}
          onChange={(event) => setSearchParams({ codeId: event.target.value })}
        >
          {CODES.map((code) => (
            <option key={code.codeId} value={code.codeId}>
              {code.codeId} - {code.name}
            </option>
          ))}
        </Select>
      </Field>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <DataTable<CodeItem>
        gridTemplateColumns="1fr 1fr 120px 220px"
        columns={[
          { key: 'codeItemId', label: 'Item ID', render: (row) => row.codeItemId },
          { key: 'name', label: 'Name', render: (row) => row.name },
          {
            key: 'sortOrder',
            label: 'Sort Order',
            render: (row) => String(row.sortOrder),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(itemPath(row))}
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`${itemPath(row)}/edit`)}
                  disabled={!canUpdate}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void removeRow(row)}
                  disabled={!canDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No code items'}
      />
    </section>
  )
}
