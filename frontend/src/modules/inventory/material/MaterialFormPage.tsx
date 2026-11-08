import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { AttachmentManager } from '@/modules/attachments'
import { toMessage } from '@/shared/api/errors'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { printDocument } from '@/shared/lib/print'
import type { FormMode } from '@/shared/types/form'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Textarea } from '@/shared/ui/Textarea'
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  getMaterialOptions,
  updateMaterial,
  type Material,
  type MaterialOptions,
} from './material.api'
import {
  emptyMaterialForm,
  materialFields,
  materialPayload,
  materialToForm,
  type MaterialForm,
} from './materialForm'

export function MaterialFormPage({ mode }: { mode: FormMode }) {
  const id = useParams().materialId
  return <MaterialEditor key={`${mode}:${id ?? ''}`} mode={mode} id={id} />
}

function MaterialEditor({ mode, id }: { mode: FormMode; id?: string }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [form, setForm] = useState<MaterialForm>({ ...emptyMaterialForm })
  const [savedForm, setSavedForm] = useState(JSON.stringify(emptyMaterialForm))
  const [record, setRecord] = useState<Material | null>(null)
  const [options, setOptions] = useState<MaterialOptions>({
    types: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== savedForm)

  useEffect(() => {
    let active = true
    Promise.all([
      getMaterialOptions(),
      mode !== 'create' && id ? getMaterial(id) : Promise.resolve(null),
    ])
      .then(([choices, row]) => {
        if (!active) return
        setOptions(choices)
        if (row) {
          const loaded = materialToForm(row)
          setForm(loaded)
          setSavedForm(JSON.stringify(loaded))
          setRecord(row)
        }
        setIsReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [id, mode])

  if (
    !hasPermission(
      mode === 'create'
        ? 'material:create'
        : mode === 'edit'
          ? 'material:update'
          : 'material:read',
    )
  ) {
    return <Navigate to="/material" replace />
  }
  const readOnly = mode !== 'create' && !hasPermission('material:update')
  const busy = isLoading || isSaving || attachmentBusy
  const blocked = busy || !isReady
  const update = (key: keyof MaterialForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || blocked) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = materialPayload(form)
      const row =
        mode === 'create'
          ? await createMaterial(form.materialId.trim(), payload)
          : await updateMaterial(id!, payload)
      const loaded = materialToForm(row)
      setForm(loaded)
      setSavedForm(JSON.stringify(loaded))
      setRecord(row)
      if (mode === 'create')
        navigate(`/material/${encodeURIComponent(row.materialId)}`, {
          replace: true,
        })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (
      !id ||
      blocked ||
      !hasPermission('material:delete') ||
      !window.confirm('이 자재를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    setError(null)
    try {
      await deleteMaterial(id)
      navigate('/material')
    } catch (e) {
      setError(toMessage(e))
      setIsSaving(false)
    }
  }

  const renderField = ([key, label]: (typeof materialFields)[number]) => {
    const required = ['materialId', 'name', 'typeCode', 'baseUnit'].includes(
      key,
    )
    const choices = key === 'typeCode' ? options.types : null
    const disabled =
      readOnly ||
      blocked ||
      (key === 'materialId' &&
        (mode !== 'create' || Boolean(form.attachmentId)))
    const maxLength = (
      {
        materialId: 50,
        name: 150,
        typeCode: 50,
        baseUnit: 30,
        maker: 100,
        model: 100,
      } as Record<string, number>
    )[key]
    return (
      <Field key={key} label={label} required={required}>
        {choices ? (
          <Select
            value={form[key]}
            required={required}
            disabled={disabled}
            onChange={(e) => update(key, e.target.value)}
          >
            <option value="">선택</option>
            {form[key] && !choices.some((c) => c.value === form[key]) && (
              <option value={form[key]}>{form[key]} (기존 값)</option>
            )}
            {choices.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.value})
              </option>
            ))}
          </Select>
        ) : key === 'note' || key === 'spec' ? (
          <Textarea
            value={form[key]}
            disabled={disabled}
            onChange={(e) => update(key, e.target.value)}
          />
        ) : (
          <Input
            maxLength={maxLength}
            value={form[key]}
            required={required}
            disabled={disabled}
            onChange={(e) => update(key, e.target.value)}
          />
        )}
      </Field>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-slate-900">자재 마스터</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || blocked}
            onClick={() =>
              printDocument({
                title: '자재 마스터',
                fields: materialFields.map(([key, label]) => [
                  label,
                  form[key],
                ]),
              })
            }
          >
            인쇄
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (confirmLeave()) navigate('/material')
            }}
          >
            목록
          </Button>
          {!readOnly && (
            <Button type="submit" form="material-form" disabled={blocked}>
              저장
            </Button>
          )}
          {mode !== 'create' && hasPermission('material:delete') && (
            <Button
              type="button"
              variant="danger"
              disabled={blocked}
              onClick={() => void remove()}
            >
              삭제
            </Button>
          )}
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <form
        id="material-form"
        onSubmit={(e) => void save(e)}
        className="space-y-4 border border-slate-200 bg-white p-3"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {materialFields.map(renderField)}
        </div>
      </form>
      <div className="border border-slate-200 bg-white p-3">
        <AttachmentManager
          attachmentId={form.attachmentId}
          refModule="material"
          refId={form.materialId.trim()}
          disabled={
            readOnly ||
            isLoading ||
            isSaving ||
            !isReady ||
            !form.materialId.trim()
          }
          onBusyChange={setAttachmentBusy}
          onError={setError}
          onAttachmentIdChange={(attachmentId) =>
            setForm((current) => ({ ...current, attachmentId }))
          }
        />
      </div>
      {record && (
        <div className="grid gap-1 text-xs text-slate-500 md:grid-cols-2">
          <span>
            등록자: {record.createdBy} / 등록일시: {record.createdAt}
          </span>
          <span>
            수정자: {record.updatedBy || '-'} / 수정일시:{' '}
            {record.updatedAt || '-'}
          </span>
        </div>
      )}
    </section>
  )
}
