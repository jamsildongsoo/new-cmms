import { Edit3, Eye, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toMessage } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import type { FormMode } from '../types/form'

export interface MasterField<TForm> {
  key: Extract<keyof TForm, string>
  label: string
  required?: boolean
  disabledOnEdit?: boolean
}

export interface MasterColumn<TRow> {
  key: string
  label: string
  render: (row: TRow) => string
}

interface MasterPageProps<TRow, TForm> {
  title: string
  subtitle: string
  permissionPrefix: string
  idLabel: string
  getId: (row: TRow) => string
  emptyForm: TForm
  fields: MasterField<TForm>[]
  columns: MasterColumn<TRow>[]
  toForm: (row: TRow) => TForm
  loadRows: () => Promise<TRow[]>
  createRow: (payload: TForm) => Promise<TRow>
  updateRow: (id: string, payload: TForm) => Promise<TRow>
  deleteRow: (id: string) => Promise<TRow>
}

const formTitles: Record<FormMode, string> = {
  create: 'New',
  edit: 'Edit',
  view: 'View',
}

function normalizeFormValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value)
}

export function MasterPage<
  TRow,
  TForm extends object,
>({
  title,
  subtitle,
  permissionPrefix,
  idLabel,
  getId,
  emptyForm,
  fields,
  columns,
  toForm,
  loadRows,
  createRow,
  updateRow,
  deleteRow,
}: MasterPageProps<TRow, TForm>) {
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<TRow[]>([])
  const [form, setForm] = useState<TForm>(emptyForm)
  const [activeRow, setActiveRow] = useState<TRow | null>(null)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const canCreate = hasPermission(`${permissionPrefix}:create`)
  const canUpdate = hasPermission(`${permissionPrefix}:update`)
  const canDelete = hasPermission(`${permissionPrefix}:delete`)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      setRows(await loadRows())
    } catch (loadError) {
      setError(toMessage(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [loadRows])

  useEffect(() => {
    let active = true
    loadRows()
      .then((data) => active && setRows(data))
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [loadRows])

  const openForm = (nextMode: FormMode, row: TRow | null = null) => {
    setActiveRow(row)
    setForm(row ? toForm(row) : emptyForm)
    setMode(nextMode)
    setError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setMode(null)
    setActiveRow(null)
    setForm(emptyForm)
  }

  // Key fields are immutable, so the backend update DTOs do not accept them.
  const toUpdatePayload = (current: TForm) => {
    const immutableKeys = fields
      .filter((field) => field.disabledOnEdit)
      .map((field) => field.key as string)
    return Object.fromEntries(
      Object.entries(current).filter(([key]) => !immutableKeys.includes(key)),
    ) as TForm
  }

  const saveRow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'edit' && activeRow) {
        await updateRow(getId(activeRow), toUpdatePayload(form))
        setNotice(`${title} updated`)
      } else {
        await createRow(form)
        setNotice(`${title} created`)
      }
      closeForm()
      setRows(await loadRows())
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const removeRow = async (row: TRow) => {
    const id = getId(row)
    if (!window.confirm(`Delete ${idLabel} ${id}?`)) {
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      await deleteRow(id)
      setNotice(`${title} deleted`)
      setRows(await loadRows())
    } catch (deleteError) {
      setError(toMessage(deleteError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            disabled={isLoading || isSaving}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => openForm('create')}
            disabled={!canCreate || isSaving}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div
          className={[
            'border px-3 py-2 text-xs',
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          ].join(' ')}
        >
          {error ?? notice}
        </div>
      )}

      {mode && (
        <form
          className="border border-slate-200 bg-white p-3"
          onSubmit={(event) => void saveRow(event)}
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            {formTitles[mode]} {title}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <Field
                key={String(field.key)}
                label={field.label}
                required={field.required}
              >
                <Input
                  value={normalizeFormValue(form[field.key])}
                  disabled={
                    mode === 'view' || (mode === 'edit' && field.disabledOnEdit)
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              {mode === 'view' ? 'Close' : 'Cancel'}
            </Button>
            {mode === 'view' ? (
              <Button
                type="button"
                onClick={() => openForm('edit', activeRow)}
                disabled={!canUpdate}
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <Button type="submit" disabled={isSaving}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            )}
          </div>
        </form>
      )}

      <DataTable<TRow>
        gridTemplateColumns={`${columns.map(() => '1fr').join(' ')} 220px`}
        columns={[
          ...columns,
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openForm('view', row)}
                >
                  <Eye className="h-4 w-4" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openForm('edit', row)}
                  disabled={!canUpdate || isSaving}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void removeRow(row)}
                  disabled={!canDelete || isSaving}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : `No ${title.toLowerCase()}`}
      />
    </section>
  )
}
