import { Edit3, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { toMessage } from '../api/errors'
import {
  createPreventiveMaintenance,
  getPreventiveMaintenance,
  PM_MODULE,
  updatePreventiveMaintenance,
  type PreventiveMaintenance,
  type PreventiveMaintenancePayload,
} from '../api/preventiveMaintenance.api'
import { AttachmentManager } from '../components/AttachmentManager'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Textarea } from '../components/ui/Textarea'
import type { FormMode } from '../types/form'

interface PreventiveMaintenanceFormProps {
  mode: FormMode
  // Required for edit/view; create generates a new UUID internally.
  id?: string
  canEdit?: boolean
  onSaved?: (document: PreventiveMaintenance) => void
  onModeChange?: (mode: FormMode) => void
  onClose?: () => void
}

interface FormState {
  documentNo: string
  title: string
  equipmentId: string
  plannedDate: string
  typeCode: string
  content: string
  note: string
  attachmentId: string | null
}

const emptyForm: FormState = {
  documentNo: '',
  title: '',
  equipmentId: '',
  plannedDate: '',
  typeCode: '',
  content: '',
  note: '',
  attachmentId: null,
}

function toForm(document: PreventiveMaintenance): FormState {
  return {
    documentNo: document.documentNo,
    title: document.title,
    equipmentId: document.equipmentId,
    plannedDate: document.plannedDate ?? '',
    typeCode: document.typeCode ?? '',
    content: document.content ?? '',
    note: document.note ?? '',
    attachmentId: document.attachmentId,
  }
}

function toPayload(form: FormState): PreventiveMaintenancePayload {
  return {
    documentNo: form.documentNo,
    title: form.title,
    equipmentId: form.equipmentId,
    plannedDate: form.plannedDate || null,
    typeCode: form.typeCode || null,
    content: form.content || null,
    attachmentId: form.attachmentId,
    note: form.note || null,
  }
}

export function PreventiveMaintenanceForm({
  mode,
  id,
  canEdit = false,
  onSaved,
  onModeChange,
  onClose,
}: PreventiveMaintenanceFormProps) {
  const [newId] = useState(() => crypto.randomUUID())
  const pmId = mode === 'create' ? newId : id
  const [document, setDocument] = useState<PreventiveMaintenance | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loadedId, setLoadedId] = useState<string | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getPreventiveMaintenance(id)
      .then((loaded) => {
        if (active) {
          setDocument(loaded)
          setForm(toForm(loaded))
          setLoadedId(id)
        }
      })
      .catch((loadError) => active && setError(toMessage(loadError)))
    return () => {
      active = false
    }
  }, [mode, id])

  const isLoading = mode !== 'create' && loadedId !== id && !error
  const readOnly = mode === 'view'
  const isEditable = document?.status === 'D'

  const setField = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pmId) {
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const saved =
        mode === 'create'
          ? await createPreventiveMaintenance(pmId, toPayload(form))
          : await updatePreventiveMaintenance(pmId, toPayload(form))
      setDocument(saved)
      onSaved?.(saved)
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="p-4 text-xs text-slate-500">Loading...</div>
  }

  return (
    <form onSubmit={save} className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {mode === 'create'
            ? 'New Preventive Maintenance'
            : mode === 'edit'
              ? 'Edit Preventive Maintenance'
              : 'Preventive Maintenance'}
          {document && <StatusBadge status={document.status} />}
        </div>
        <div className="flex gap-2">
          {readOnly && canEdit && isEditable && onModeChange && (
            <Button variant="secondary" onClick={() => onModeChange('edit')}>
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          )}
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              <X className="h-4 w-4" />
              Close
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Document No" required>
          <Input
            value={form.documentNo}
            disabled={readOnly}
            required
            onChange={(event) => setField('documentNo', event.target.value)}
          />
        </Field>
        <Field label="Title" required>
          <Input
            value={form.title}
            disabled={readOnly}
            required
            onChange={(event) => setField('title', event.target.value)}
          />
        </Field>
        <Field label="Equipment ID" required>
          <Input
            value={form.equipmentId}
            disabled={readOnly}
            required
            onChange={(event) => setField('equipmentId', event.target.value)}
          />
        </Field>
        <Field label="Planned Date (YYYYMMDD)">
          <Input
            value={form.plannedDate}
            disabled={readOnly}
            pattern="\d{8}"
            onChange={(event) => setField('plannedDate', event.target.value)}
          />
        </Field>
        <Field label="Type Code">
          <Input
            value={form.typeCode}
            disabled={readOnly}
            onChange={(event) => setField('typeCode', event.target.value)}
          />
        </Field>
      </div>
      <Field label="Content">
        <Textarea
          value={form.content}
          disabled={readOnly}
          rows={4}
          onChange={(event) => setField('content', event.target.value)}
        />
      </Field>
      <Field label="Note">
        <Textarea
          value={form.note}
          disabled={readOnly}
          rows={2}
          onChange={(event) => setField('note', event.target.value)}
        />
      </Field>

      {pmId && (
        <AttachmentManager
          attachmentId={form.attachmentId}
          refModule={PM_MODULE}
          refId={pmId}
          disabled={readOnly}
          onAttachmentIdChange={(attachmentId) =>
            setForm((current) => ({ ...current, attachmentId }))
          }
          onError={setError}
        />
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      )}
    </form>
  )
}
