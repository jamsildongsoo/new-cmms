import { Edit3, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AttachmentManager } from '@/modules/attachments'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import {
  createPreventiveMaintenance,
  getPreventiveMaintenance,
  PM_MODULE,
  updatePreventiveMaintenance,
  type PreventiveMaintenance,
  type PreventiveMaintenancePayload,
} from './preventiveMaintenance.api'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/Textarea'
import type { FormMode } from '@/shared/types/form'

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

export function PreventiveMaintenanceFormPage({ mode }: { mode: FormMode }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const id = useParams().pmId
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
      navigate(`/preventive-maintenance/${saved.pmId}`)
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const requiredPermission =
    mode === 'create'
      ? 'preventive_maintenance:create'
      : mode === 'edit'
        ? 'preventive_maintenance:update'
        : 'preventive_maintenance:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/preventive-maintenance" replace />
  }
  const canUpdate = hasPermission('preventive_maintenance:update')

  if (isLoading) {
    return <div className="p-4 text-xs text-slate-500">Loading...</div>
  }

  if (mode === 'edit' && document && !isEditable) {
    return <Navigate to={`/preventive-maintenance/${document.pmId}`} replace />
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="space-y-3 border border-slate-200 bg-white p-3"
    >
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
          {readOnly && canUpdate && isEditable && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('edit')}
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          )}
          <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/preventive-maintenance')}
            >
              <X className="h-4 w-4" />
              Close
            </Button>
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
