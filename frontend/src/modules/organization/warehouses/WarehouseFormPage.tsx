import { Edit3, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  createWarehouse,
  getWarehouse,
  updateWarehouse,
} from './warehouses.api'
import { useAuth } from '@/modules/auth'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import type { FormMode } from '@/shared/types/form'

interface WarehouseFormState {
  warehouseId: string
  name: string
  siteId: string
}

const emptyForm: WarehouseFormState = { warehouseId: '', name: '', siteId: '' }

const titles: Record<FormMode, string> = {
  create: 'New Warehouse',
  edit: 'Edit Warehouse',
  view: 'View Warehouse',
}

export function WarehouseFormPage({ mode }: { mode: FormMode }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const id = useParams().warehouseId

  const [form, setForm] = useState<WarehouseFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getWarehouse(id)
      .then((row) => active && setForm({
          warehouseId: row.warehouseId,
          name: row.name,
          siteId: row.siteId ?? '',
        }))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, id])

  const requiredPermission =
    mode === 'create' ? 'warehouse:create' : mode === 'edit' ? 'warehouse:update' : 'warehouse:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/warehouses" replace />
  }

  const readOnly = mode === 'view'

  const update = (key: keyof WarehouseFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      if (mode === 'edit' && id) {
        // Key fields are immutable, so the backend update DTO does not accept them.
        const payload: Partial<WarehouseFormState> = { ...form }
        delete payload.warehouseId
        await updateWarehouse(id, payload as Omit<WarehouseFormState, 'warehouseId'>)
      } else {
        await createWarehouse({ ...form })
      }
      navigate('/warehouses')
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
          <Field label="Warehouse ID" required>
            <Input
              value={form.warehouseId}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('warehouseId', event.target.value)}
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
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/warehouses')}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {readOnly ? (
            <Button
              type="button"
              onClick={() => navigate('edit')}
              disabled={!hasPermission('warehouse:update') || isLoading}
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
