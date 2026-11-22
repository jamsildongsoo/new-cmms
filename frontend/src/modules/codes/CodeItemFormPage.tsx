// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { Edit3, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import { createCodeItem, getCodeItem, updateCodeItem } from './codes.api'
import { useAuth } from '../auth/useAuth'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { useMetadata } from '@/shared/metadata/metadata'
import type { FormMode } from '@/shared/types/form'

interface CodeItemFormState {
  codeItemId: string
  name: string
  sortOrder: string
}

const emptyForm: CodeItemFormState = { codeItemId: '', name: '', sortOrder: '' }

const titles: Record<FormMode, string> = {
  create: '공통코드 신규 작성',
  edit: '공통코드 수정',
  view: '공통코드 조회',
}

export function CodeItemFormPage({ mode }: { mode: FormMode }) {
  const { codeGroups } = useMetadata()
  const isCodeGroupId = (value: string | null | undefined): value is string =>
    typeof value === 'string' && codeGroups.some((g) => g.codeId === value)
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const params = useParams()
  const [searchParams] = useSearchParams()

  const paramCodeId =
    mode === 'create' ? searchParams.get('codeId') : params.codeId
  const codeItemId = params.codeItemId
  const codeId = isCodeGroupId(paramCodeId) ? paramCodeId : null
  const listPath = `/code-items?codeId=${codeId ?? ''}`

  const [form, setForm] = useState<CodeItemFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !codeId || !codeItemId) {
      return
    }
    let active = true
    getCodeItem(codeId, codeItemId)
      .then((item) => {
        if (active) {
          setForm({
            codeItemId: item.codeItemId,
            name: item.name,
            sortOrder: String(item.sortOrder),
          })
        }
      })
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, codeId, codeItemId])

  if (!codeId) {
    return <Navigate to="/code-items" replace />
  }

  const requiredPermission =
    mode === 'create'
      ? 'CODE:create'
      : mode === 'edit'
        ? 'CODE:update'
        : 'CODE:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to={listPath} replace />
  }

  const codeName = codeGroups.find((code) => code.codeId === codeId)?.label
  const readOnly = mode === 'view'

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (mode === 'edit' && codeItemId) {
        await updateCodeItem(codeId, codeItemId, {
          name: form.name,
          sortOrder: form.sortOrder,
        })
      } else {
        await createCodeItem({ codeId, ...form })
      }
      navigate(listPath)
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const update = (key: keyof CodeItemFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{titles[mode]}</h1>
        <p className="text-xs text-slate-500">
          {codeId} - {codeName}
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        className="rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="항목 ID" required>
            <Input
              value={form.codeItemId}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('codeItemId', event.target.value)}
              required
            />
          </Field>
          <Field label="명칭" required>
            <Input
              value={form.name}
              disabled={readOnly || isLoading}
              onChange={(event) => update('name', event.target.value)}
              required
            />
          </Field>
          <Field label="정렬 순서">
            <Input
              type="number"
              min={0}
              value={form.sortOrder}
              disabled={readOnly || isLoading}
              onChange={(event) => update('sortOrder', event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(listPath)}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            {readOnly ? '닫기' : '취소'}
          </Button>
          {readOnly ? (
            <Button
              type="button"
              onClick={() => navigate('edit')}
              disabled={!hasPermission('CODE:update') || isLoading}
            >
              <Edit3 className="h-4 w-4" />
              수정
            </Button>
          ) : (
            <Button type="submit" disabled={isSaving || isLoading}>
              <Save className="h-4 w-4" />
              저장
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
