// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import { createSite, getSite, updateSite, deleteSite } from './sites.api'
import { useAuth } from '@/modules/auth'
import { printDocument } from '@/shared/lib/print'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import type { FormMode } from '@/shared/types/form'

interface SiteFormState {
  siteId: string
  name: string
}

const emptyForm: SiteFormState = { siteId: '', name: '' }

export function SiteFormPage({ mode }: { mode: FormMode }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const id = useParams().siteId

  const [form, setForm] = useState<SiteFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [savedForm, setSavedForm] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getSite(id)
      .then((row) => {
        if (active) {
          const loaded = { siteId: row.siteId, name: row.name }
          setForm(loaded)
          setSavedForm(JSON.stringify(loaded))
        }
      })
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, id])

  const dirty =
    savedForm === null
      ? mode === 'create' && JSON.stringify(form) !== JSON.stringify(emptyForm)
      : JSON.stringify(form) !== savedForm
  const confirmLeave = useUnsavedChanges(dirty)

  const requiredPermission =
    mode === 'create'
      ? 'SITE:create'
      : mode === 'edit'
        ? 'SITE:update'
        : 'SITE:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/sites" replace />
  }

  const readOnly = mode !== 'create' && !hasPermission('SITE:update')

  const update = (key: keyof SiteFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSaving || isLoading) return
    setIsSaving(true)
    setError(null)
    try {
      const saved =
        mode !== 'create' && id
          ? await updateSite(id, { name: form.name })
          : await createSite({ ...form })
      const loaded = { siteId: saved.siteId, name: saved.name }
      setForm(loaded)
      setSavedForm(JSON.stringify(loaded))
      navigate(`/sites/${encodeURIComponent(saved.siteId)}`, {
        replace: mode === 'create',
      })
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (
      !id ||
      isSaving ||
      !hasPermission('SITE:delete') ||
      !window.confirm('이 정보를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    try {
      await deleteSite(id)
      navigate('/sites')
    } catch (error) {
      setError(toMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">사업장</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              if (confirmLeave()) navigate('/sites')
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || isLoading || isSaving}
            onClick={() =>
              printDocument({
                title: '사업장',
                fields: [
                  ['사업장코드', form.siteId],
                  ['사업장명', form.name],
                ],
              })
            }
          >
            인쇄
          </Button>
          {mode !== 'create' && hasPermission('SITE:delete') && (
            <Button
              className="sm:ml-2"
              type="button"
              variant="danger"
              disabled={isSaving || isLoading}
              onClick={() => void remove()}
            >
              삭제
            </Button>
          )}
          {!readOnly && (
            <Button
              type="submit"
              form="sites-form"
              disabled={isSaving || isLoading}
            >
              저장
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        id="sites-form"
        className="rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="사업장코드" required>
            <Input
              value={form.siteId}
              required
              maxLength={30}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('siteId', event.target.value)}
            />
          </Field>
          <Field label="사업장명" required>
            <Input
              value={form.name}
              required
              maxLength={100}
              disabled={readOnly || isLoading}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
        </div>
      </form>
    </section>
  )
}
