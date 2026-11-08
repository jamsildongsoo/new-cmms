import { ChildEquipmentList, ParentEquipmentSelect } from './EquipmentTree'
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
  createEquipment,
  deleteEquipment,
  getEquipment,
  getEquipmentOptions,
  updateEquipment,
  type Equipment,
  type EquipmentOptions,
} from './equipment.api'
import {
  emptyEquipmentForm,
  equipmentFields,
  equipmentFieldGroups,
  equipmentPayload,
  equipmentToForm,
  inspectionUnits,
  type EquipmentForm,
} from './equipmentForm'

export function EquipmentFormPage({ mode }: { mode: FormMode }) {
  const id = useParams().equipmentId
  return <EquipmentEditor key={`${mode}:${id ?? ''}`} mode={mode} id={id} />
}

function EquipmentEditor({ mode, id }: { mode: FormMode; id?: string }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [form, setForm] = useState<EquipmentForm>({ ...emptyEquipmentForm })
  const [savedForm, setSavedForm] = useState(JSON.stringify(emptyEquipmentForm))
  const [record, setRecord] = useState<Equipment | null>(null)
  const [options, setOptions] = useState<EquipmentOptions>({
    sites: [],
    departments: [],
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
      getEquipmentOptions(),
      mode !== 'create' && id ? getEquipment(id) : Promise.resolve(null),
    ])
      .then(([choices, row]) => {
        if (!active) return
        setOptions(choices)
        if (row) {
          const loaded = equipmentToForm(row)
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
        ? 'equipment:create'
        : mode === 'edit'
          ? 'equipment:update'
          : 'equipment:read',
    )
  ) {
    return <Navigate to="/equipment" replace />
  }
  const readOnly = mode !== 'create' && !hasPermission('equipment:update')
  const busy = isLoading || isSaving || attachmentBusy
  const blocked = busy || !isReady
  const update = (key: keyof EquipmentForm, value: string) =>
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'siteId' && value !== current.siteId)
        next.parentEquipmentId = ''
      if (!Number(next.inspectionPeriod) || !next.inspectionUnit)
        next.nextInspectionDate = ''
      return next
    })

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || blocked) return
    setIsSaving(true)
    setError(null)
    try {
      const payload = equipmentPayload(form)
      const row =
        mode === 'create'
          ? await createEquipment(form.equipmentId.trim(), payload)
          : await updateEquipment(id!, payload)
      const loaded = equipmentToForm(row)
      setForm(loaded)
      setSavedForm(JSON.stringify(loaded))
      setRecord(row)
      if (mode === 'create')
        navigate(`/equipment/${encodeURIComponent(row.equipmentId)}`, {
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
      !hasPermission('equipment:delete') ||
      !window.confirm('이 설비를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    setError(null)
    try {
      await deleteEquipment(id)
      navigate('/equipment')
    } catch (e) {
      setError(toMessage(e))
      setIsSaving(false)
    }
  }

  const renderField = ([key, label]: (typeof equipmentFields)[number]) => {
    if (key === 'parentEquipmentId')
      return (
        <Field key={key} label={label}>
          <ParentEquipmentSelect
            siteId={form.siteId}
            equipmentId={form.equipmentId}
            value={form.parentEquipmentId}
            disabled={readOnly || blocked}
            onChange={(value) => update('parentEquipmentId', value)}
          />
        </Field>
      )
    const required = [
      'equipmentId',
      'name',
      'siteId',
      'deptId',
      'typeCode',
    ].includes(key)
    const choices = key.endsWith('Yn')
      ? [
          { value: 'N', label: '아니오' },
          { value: 'Y', label: '예' },
        ]
      : key === 'siteId'
        ? options.sites
        : key === 'deptId'
          ? options.departments
          : key === 'typeCode'
            ? options.types
            : key.endsWith('Unit')
              ? inspectionUnits
              : null
    const disabled =
      readOnly ||
      blocked ||
      (key === 'equipmentId' &&
        (mode !== 'create' || Boolean(form.attachmentId))) ||
      (key === 'nextInspectionDate' &&
        (!Number(form.inspectionPeriod) || !form.inspectionUnit))
    const maxLength = (
      {
        equipmentId: 50,
        name: 150,
        location: 200,
        maker: 100,
        model: 100,
        serialNo: 100,
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
            type={
              key.endsWith('Date')
                ? 'date'
                : key.endsWith('Period')
                  ? 'number'
                  : 'text'
            }
            min={key.endsWith('Period') ? 0 : undefined}
            step={key.endsWith('Period') ? 1 : undefined}
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
        <h1 className="text-base font-semibold text-slate-900">설비 마스터</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || blocked}
            onClick={() =>
              printDocument({
                title: '설비 마스터',
                fields: equipmentFields.map(([key, label]) => [
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
              if (confirmLeave()) navigate('/equipment')
            }}
          >
            목록
          </Button>
          {!readOnly && (
            <Button type="submit" form="equipment-form" disabled={blocked}>
              저장
            </Button>
          )}
          {mode !== 'create' && hasPermission('equipment:delete') && (
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
        id="equipment-form"
        onSubmit={(e) => void save(e)}
        className="space-y-4 border border-slate-200 bg-white p-3"
      >
        {equipmentFieldGroups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {equipmentFields
                .filter(([key]) => group.keys.includes(key))
                .map(renderField)}
            </div>
          </section>
        ))}
      </form>
      <div className="border border-slate-200 bg-white p-3">
        <AttachmentManager
          attachmentId={form.attachmentId}
          refModule="equipment"
          refId={form.equipmentId.trim()}
          disabled={
            readOnly ||
            isLoading ||
            isSaving ||
            !isReady ||
            !form.equipmentId.trim()
          }
          onBusyChange={setAttachmentBusy}
          onError={setError}
          onAttachmentIdChange={(attachmentId) =>
            setForm((current) => ({ ...current, attachmentId }))
          }
        />
      </div>
      {record && (
        <ChildEquipmentList
          siteId={record.siteId}
          equipmentId={record.equipmentId}
        />
      )}
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
