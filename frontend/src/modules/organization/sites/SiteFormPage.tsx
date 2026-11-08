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
      ? 'site:create'
      : mode === 'edit'
        ? 'site:update'
        : 'site:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/sites" replace />
  }

  const readOnly = mode !== 'create' && !hasPermission('site:update')

  const update = (key: keyof SiteFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSaving || isLoading) return
    setIsSaving(true)
    setError(null)
    try {
      if (mode !== 'create' && id) {
        // Key fields are immutable, so the backend update DTO does not accept them.
        const payload: Partial<SiteFormState> = { ...form }
        delete payload.siteId
        await updateSite(id, payload as Omit<SiteFormState, 'siteId'>)
      } else {
        await createSite({ ...form })
      }
      setSavedForm(JSON.stringify(form))
      navigate(`/sites/${encodeURIComponent(form.siteId)}`, {
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
      !hasPermission('site:delete') ||
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
        <h1 className="text-base font-semibold text-slate-900">사업장</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || isLoading || isSaving}
            onClick={() =>
              printDocument({
                title: '사업장',
                fields: Object.entries(form).map(([key, value]) => [
                  key,
                  value,
                ]),
              })
            }
          >
            인쇄
          </Button>
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
          {!readOnly && (
            <Button
              type="submit"
              form="sites-form"
              disabled={isSaving || isLoading}
            >
              저장
            </Button>
          )}
          {mode !== 'create' && hasPermission('site:delete') && (
            <Button
              type="button"
              variant="danger"
              disabled={isSaving || isLoading}
              onClick={() => void remove()}
            >
              삭제
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
        className="border border-slate-200 bg-white p-3"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Site ID" required>
            <Input
              value={form.siteId}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('siteId', event.target.value)}
            />
          </Field>
          <Field label="Name" required>
            <Input
              value={form.name}
              disabled={readOnly || isLoading}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
        </div>
      </form>
    </section>
  )
}
