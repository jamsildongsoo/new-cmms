import { Edit3, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  createDepartment,
  getDepartment,
  updateDepartment,
} from './departments.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import type { FormMode } from '@/shared/types/form'

interface DepartmentFormState {
  deptId: string
  name: string
  siteId: string
  parentDeptId: string
}

const emptyForm: DepartmentFormState = { deptId: '', name: '', siteId: '', parentDeptId: '' }

const titles: Record<FormMode, string> = {
  create: 'New Department',
  edit: 'Edit Department',
  view: 'View Department',
}

export function DepartmentFormPage({ mode }: { mode: FormMode }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const id = useParams().deptId

  const [form, setForm] = useState<DepartmentFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getDepartment(id)
      .then((row) => active && setForm({
          deptId: row.deptId,
          name: row.name,
          siteId: row.siteId ?? '',
          parentDeptId: row.parentDeptId ?? '',
        }))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, id])

  const requiredPermission =
    mode === 'create' ? 'department:create' : mode === 'edit' ? 'department:update' : 'department:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/departments" replace />
  }

  const readOnly = mode === 'view'

  const update = (key: keyof DepartmentFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (mode === 'edit' && id) {
        // Key fields are immutable, so the backend update DTO does not accept them.
        const payload: Partial<DepartmentFormState> = { ...form }
        delete payload.deptId
        await updateDepartment(id, payload as Omit<DepartmentFormState, 'deptId'>)
      } else {
        await createDepartment({ ...form })
      }
      navigate('/departments')
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <h1 className="text-base font-semibold text-slate-900">{titles[mode]}</h1>

      {error && (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        className="border border-slate-200 bg-white p-3"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Department ID" required>
            <Input
              value={form.deptId}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('deptId', event.target.value)}
            />
          </Field>
          <Field label="Name" required>
            <Input
              value={form.name}
              disabled={readOnly || isLoading}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
          <Field label="Site ID">
            <Input
              value={form.siteId}
              disabled={readOnly || isLoading}
              onChange={(event) => update('siteId', event.target.value)}
            />
          </Field>
          <Field label="Parent Department ID">
            <Input
              value={form.parentDeptId}
              disabled={readOnly || isLoading}
              onChange={(event) => update('parentDeptId', event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/departments')}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {readOnly ? (
            <Button
              type="button"
              onClick={() => navigate('edit')}
              disabled={!hasPermission('department:update') || isLoading}
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <Button type="submit" disabled={isSaving || isLoading}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}
