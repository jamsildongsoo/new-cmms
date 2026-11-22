// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
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
import { useMetadata } from '@/shared/metadata/metadata'

export function CodeItemListPage() {
  const { codeGroups } = useMetadata()
  const isCodeGroupId = (value: string | null | undefined): value is string =>
    typeof value === 'string' && codeGroups.some((g) => g.codeId === value)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasPermission } = useAuth()
  const queryCodeId = searchParams.get('codeId')
  const codeId = isCodeGroupId(queryCodeId)
    ? queryCodeId
    : (codeGroups[0]?.codeId ?? '')

  const [rows, setRows] = useState<CodeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = hasPermission('CODE:create')
  const canUpdate = hasPermission('CODE:update')
  const canDelete = hasPermission('CODE:delete')

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
    if (
      !window.confirm(`공통코드 ${row.codeItemId} 항목을 삭제하시겠습니까?`)
    ) {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            공통코드 관리
          </h1>
          <p className="text-xs text-slate-500">
            선택한 코드의 항목 목록입니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
          <Button
            onClick={() => navigate(`/code-items/new?codeId=${codeId}`)}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4" />
            신규 작성
          </Button>
        </div>
      </div>

      <Field label="코드" className="max-w-sm">
        <Select
          value={codeId}
          onChange={(event) => setSearchParams({ codeId: event.target.value })}
        >
          {codeGroups.map((code) => (
            <option key={code.codeId} value={code.codeId}>
              {code.codeId} - {code.label}
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
          {
            key: 'codeItemId',
            label: '항목 ID',
            render: (row) => row.codeItemId,
          },
          { key: 'name', label: '명칭', render: (row) => row.name },
          {
            key: 'sortOrder',
            label: '정렬 순서',
            render: (row) => String(row.sortOrder),
          },
          {
            key: 'actions',
            label: '조작',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(itemPath(row))}
                >
                  <Eye className="h-4 w-4" />
                  보기
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`${itemPath(row)}/edit`)}
                  disabled={!canUpdate}
                >
                  <Edit3 className="h-4 w-4" />
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void removeRow(row)}
                  disabled={!canDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyText={isLoading ? '불러오는 중…' : '조회된 공통코드가 없습니다.'}
      />
    </section>
  )
}
