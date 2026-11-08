import { DocumentIdField } from '@/shared/ui/DocumentIdField'
import { AttachmentManager } from '@/modules/attachments'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { dateInput } from '@/modules/maintenance/equipment'
import { toMessage } from '@/shared/api/errors'
import {
  createPreventiveMaintenance,
  getPreventiveMaintenance,
  updatePreventiveMaintenance,
  deletePreventiveMaintenance,
  getPMOptions,
  type PreventiveMaintenance,
  type PreventiveMaintenancePayload,
  type InspectionItem,
  type PMOptions,
} from './preventiveMaintenance.api'
import { printDocument } from '@/shared/lib/print'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { toPreventiveMaintenanceDraft } from './approvalDraft'
import { calculateNextInspectionDate } from './inspectionDate'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { StatusBadge } from '@/shared/ui/StatusBadge'
import { Textarea } from '@/shared/ui/Textarea'
import type { FormMode } from '@/shared/types/form'

interface FormState {
  attachmentId: string | null
  documentNo: string
  title: string
  equipmentId: string
  result: '' | 'OK' | 'NOK'
  inspectionDeptId: string
  inspectorId: string
  inspectionDate: string
  nextInspectionDate: string
  typeCode: string
  content: string
  note: string
  items: InspectionItem[]
}
const emptyForm: FormState = {
  attachmentId: null,
  documentNo: '',
  title: '',
  equipmentId: '',
  result: '',
  inspectionDeptId: '',
  inspectorId: '',
  inspectionDate: '',
  nextInspectionDate: '',
  typeCode: '',
  content: '',
  note: '',
  items: [],
}
function toForm(document: PreventiveMaintenance): FormState {
  return {
    attachmentId: document.attachmentId ?? null,
    documentNo: document.documentNo,
    title: document.title,
    equipmentId: document.equipmentId,
    result: document.result ?? '',
    inspectionDeptId: document.inspectionDeptId ?? '',
    inspectorId: document.inspectorId ?? '',
    inspectionDate: dateInput(document.inspectionDate),
    nextInspectionDate: dateInput(document.nextInspectionDate),
    typeCode: document.typeCode ?? '',
    content: document.content ?? '',
    note: document.note ?? '',
    items: document.items ?? [],
  }
}
function toPayload(form: FormState): PreventiveMaintenancePayload {
  return {
    ...form,
    result: form.result || null,
    inspectionDeptId: form.inspectionDeptId || null,
    inspectorId: form.inspectorId || null,
    inspectionDate: form.inspectionDate.replaceAll('-', '') || null,
    nextInspectionDate: form.nextInspectionDate.replaceAll('-', '') || null,
    typeCode: form.typeCode || null,
    content: form.content || null,
    note: form.note || null,
  }
}

export function PreventiveMaintenanceFormPage({ mode }: { mode: FormMode }) {
  const id = useParams().pmId
  return <PMEditor key={`${mode}:${id ?? ''}`} mode={mode} id={id} />
}

function PMEditor({ mode, id }: { mode: FormMode; id?: string }) {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [requestKey] = useState(() => crypto.randomUUID())
  const [document, setDocument] = useState<PreventiveMaintenance | null>(null)
  const pmId = document?.pmId ?? id
  const [form, setForm] = useState<FormState>(emptyForm)
  const [options, setOptions] = useState<PMOptions>({
    departments: [],
    users: [],
    equipment: [],
    types: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm))
  const confirmLeave = useUnsavedChanges(JSON.stringify(form) !== baseline)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      getPMOptions(),
      mode !== 'create' && id
        ? getPreventiveMaintenance(id)
        : Promise.resolve(null),
    ])
      .then(([choices, loaded]) => {
        if (!active) return
        setOptions(choices)
        if (loaded) {
          setDocument(loaded)
          setForm(toForm(loaded))
          setBaseline(JSON.stringify(toForm(loaded)))
        } else {
          const initial = {
            ...emptyForm,
            inspectionDeptId: user?.deptId ?? '',
            inspectorId: user?.userId ?? '',
          }
          setForm(initial)
          setBaseline(JSON.stringify(initial))
        }
        setReady(true)
      })
      .catch((e) => active && setError(toMessage(e)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, id, user?.deptId, user?.userId])

  const isNew = mode === 'create' && !document
  const isOwner = document?.createdBy === user?.userId
  const readOnly = isNew
    ? !hasPermission('preventive_maintenance:create')
    : !(
        document?.status === 'D' &&
        isOwner &&
        hasPermission('preventive_maintenance:update')
      )
  const blocked = isSaving || isLoading || attachmentBusy || !ready
  const equipment = options.equipment.find(
    (row) => row.equipmentId === form.equipmentId,
  )
  const hasCycle = Boolean(
    equipment?.inspectionPeriod && equipment.inspectionUnit,
  )

  const setField = (key: Exclude<keyof FormState, 'items'>, value: string) =>
    setForm((current) => {
      const next = { ...current, [key]: value }
      // 점검일·설비를 바꾼 경우에만 다시 제안한다. 저장된 사용자 보정값은 조회 시 유지한다.
      if (key === 'inspectionDate' || key === 'equipmentId') {
        const selected = options.equipment.find(
          (row) => row.equipmentId === next.equipmentId,
        )
        next.nextInspectionDate = calculateNextInspectionDate(
          next.inspectionDate,
          selected?.inspectionPeriod ?? null,
          selected?.inspectionUnit ?? null,
        )
      }
      return next
    })
  const setItem = (index: number, key: keyof InspectionItem, value: string) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }))

  const save = async (submit: boolean) => {
    if (readOnly || blocked || !formRef.current?.reportValidity()) return
    if (
      submit &&
      (!form.result || !form.inspectionDeptId || !form.inspectorId)
    ) {
      setError('판정·점검부서·점검자를 입력한 뒤 상신하십시오.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const saved = isNew
        ? await createPreventiveMaintenance(requestKey, toPayload(form))
        : await updatePreventiveMaintenance(pmId!, toPayload(form))
      setDocument(saved)
      setForm(toForm(saved))
      setBaseline(JSON.stringify(toForm(saved)))
      if (submit)
        navigate('/approvals/new', {
          state: { prefill: toPreventiveMaintenanceDraft(saved) },
        })
      else if (isNew)
        navigate(`/preventive-maintenance/${saved.pmId}`, { replace: true })
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setIsSaving(false)
    }
  }
  const remove = async () => {
    if (
      !document ||
      !isOwner ||
      document.status !== 'D' ||
      !hasPermission('preventive_maintenance:delete') ||
      blocked ||
      !window.confirm('초안 문서를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    try {
      await deletePreventiveMaintenance(document.pmId)
      navigate('/preventive-maintenance')
    } catch (e) {
      setError(toMessage(e))
      setIsSaving(false)
    }
  }
  const requiredPermission =
    mode === 'create'
      ? 'preventive_maintenance:create'
      : mode === 'edit'
        ? 'preventive_maintenance:update'
        : 'preventive_maintenance:read'
  if (!hasPermission(requiredPermission))
    return <Navigate to="/preventive-maintenance" replace />
  if (mode === 'edit' && document && readOnly)
    return <Navigate to={`/preventive-maintenance/${document.pmId}`} replace />
  const disabled = readOnly || blocked

  return (
    <form
      ref={formRef}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        void save(false)
      }}
      className="space-y-3 border border-slate-200 bg-white p-3"
    >
      <DocumentIdField value={document?.pmId} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          예방점검 {document && <StatusBadge status={document.status} />}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!document || blocked}
            onClick={() =>
              printDocument({
                title: form.title || '예방점검',
                fields: [
                  ['문서번호', document?.pmId],
                  ['관리번호', form.documentNo],
                  ['설비', form.equipmentId],
                  ['점검일', form.inspectionDate],
                  ['다음 점검일', form.nextInspectionDate],
                  ['점검 유형', form.typeCode],
                  ['판정', form.result],
                  [
                    '점검부서',
                    options.departments.find(
                      (r) => r.value === form.inspectionDeptId,
                    )?.label ??
                      document?.inspectionDeptName ??
                      form.inspectionDeptId,
                  ],
                  [
                    '점검자',
                    options.users.find((r) => r.value === form.inspectorId)
                      ?.label ??
                      document?.inspectorName ??
                      form.inspectorId,
                  ],
                  ['비고', form.note],
                ],
                columns: ['항목', '기준값', '점검값', '단위'],
                rows: form.items.map((item) => [
                  item.name,
                  item.standardValue,
                  item.inspectionValue,
                  item.unit,
                ]),
                text: form.content,
              })
            }
          >
            인쇄
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving || attachmentBusy}
            onClick={() => {
              if (confirmLeave()) navigate('/preventive-maintenance')
            }}
          >
            목록
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={blocked}>
              저장
            </Button>
          )}
          {document?.status === 'D' &&
            isOwner &&
            hasPermission('preventive_maintenance:delete') && (
              <Button
                type="button"
                variant="danger"
                disabled={blocked}
                onClick={() => void remove()}
              >
                삭제
              </Button>
            )}
          {!readOnly && (
            <Button
              type="button"
              disabled={blocked}
              onClick={() => void save(true)}
            >
              상신
            </Button>
          )}
        </div>
      </div>
      {isLoading && <div className="text-xs text-slate-500">조회 중...</div>}
      {error && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="관리번호">
          <Input
            value={form.documentNo}
            maxLength={50}
            disabled={disabled}
            onChange={(e) => setField('documentNo', e.target.value)}
          />
        </Field>
        <Field label="점검명" required>
          <Input
            value={form.title}
            required
            maxLength={200}
            disabled={disabled}
            onChange={(e) => setField('title', e.target.value)}
          />
        </Field>
        <Field label="대상 설비" required>
          <Select
            value={form.equipmentId}
            required
            disabled={disabled}
            onChange={(e) => setField('equipmentId', e.target.value)}
          >
            <option value="">선택</option>
            {form.equipmentId && !equipment && (
              <option value={form.equipmentId}>
                {form.equipmentId} (기존 값)
              </option>
            )}
            {options.equipment.map((r) => (
              <option key={r.equipmentId} value={r.equipmentId}>
                {r.name} ({r.equipmentId})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="점검 유형">
          <Select
            value={form.typeCode}
            disabled={disabled}
            onChange={(e) => setField('typeCode', e.target.value)}
          >
            <option value="">선택</option>
            {form.typeCode &&
              !options.types.some((r) => r.value === form.typeCode) && (
                <option value={form.typeCode}>{form.typeCode} (기존 값)</option>
              )}
            {options.types.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="판정">
          <Select
            value={form.result}
            disabled={disabled}
            onChange={(e) => setField('result', e.target.value)}
          >
            <option value="">선택</option>
            <option value="OK">OK</option>
            <option value="NOK">NOK</option>
          </Select>
        </Field>
        {(['inspectionDeptId', 'inspectorId'] as const).map((key) => {
          const choices =
            key === 'inspectionDeptId' ? options.departments : options.users
          const oldName =
            key === 'inspectionDeptId'
              ? document?.inspectionDeptName
              : document?.inspectorName
          return (
            <Field
              key={key}
              label={key === 'inspectionDeptId' ? '점검부서' : '점검자'}
            >
              <Select
                value={form[key]}
                disabled={disabled}
                onChange={(e) => setField(key, e.target.value)}
              >
                <option value="">선택</option>
                {form[key] && !choices.some((r) => r.value === form[key]) && (
                  <option value={form[key]}>
                    {oldName || form[key]} (기존 값)
                  </option>
                )}
                {choices.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          )
        })}
        <Field label="점검일">
          <Input
            type="date"
            value={form.inspectionDate}
            disabled={disabled}
            onChange={(e) => setField('inspectionDate', e.target.value)}
          />
        </Field>
        <Field label="다음 점검일">
          <Input
            type="date"
            value={form.nextInspectionDate}
            disabled={disabled || !hasCycle || !form.inspectionDate}
            onChange={(e) => setField('nextInspectionDate', e.target.value)}
          />
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        {hasCycle
          ? '다음 점검일은 설비 주기로 계산하며 변경할 수 있습니다.'
          : '점검 주기가 없는 설비는 다음 점검일을 비워 둡니다.'}
      </p>
      <Field label="점검 내용">
        <Textarea
          value={form.content}
          disabled={disabled}
          rows={3}
          onChange={(e) => setField('content', e.target.value)}
        />
      </Field>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">점검 상세</h2>
          {!readOnly && (
            <Button
              type="button"
              variant="secondary"
              disabled={blocked}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  items: [
                    ...current.items,
                    {
                      name: '',
                      standardValue: '',
                      inspectionValue: '',
                      unit: '',
                    },
                  ],
                }))
              }
            >
              항목 추가
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {['항목', '기준값', '점검값', '단위'].map((label) => (
                  <th key={label} className="bg-slate-50 p-2 text-left">
                    {label}
                  </th>
                ))}
                {!readOnly && (
                  <th className="bg-slate-50 p-2">
                    <span className="sr-only">항목 삭제</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={readOnly ? 4 : 5}
                    className="border p-3 text-center text-slate-500"
                  >
                    점검 상세가 없습니다.
                  </td>
                </tr>
              ) : (
                form.items.map((item, index) => (
                  <tr key={index}>
                    {(
                      [
                        'name',
                        'standardValue',
                        'inspectionValue',
                        'unit',
                      ] as const
                    ).map((key, column) => (
                      <td key={key} className="border p-1">
                        <Input
                          aria-label={`${index + 1}행 ${['항목', '기준값', '점검값', '단위'][column]}`}
                          required={key === 'name'}
                          maxLength={
                            key === 'name' ? 200 : key === 'unit' ? 50 : 500
                          }
                          value={item[key]}
                          disabled={disabled}
                          onChange={(e) => setItem(index, key, e.target.value)}
                        />
                      </td>
                    ))}
                    {!readOnly && (
                      <td className="border p-1">
                        <Button
                          type="button"
                          variant="danger"
                          disabled={blocked}
                          aria-label={`${index + 1}행 삭제`}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              items: current.items.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                        >
                          삭제
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Field label="비고">
        <Textarea
          value={form.note}
          disabled={disabled}
          rows={2}
          onChange={(e) => setField('note', e.target.value)}
        />
      </Field>
      <AttachmentManager
        attachmentId={form.attachmentId}
        refModule="preventive_maintenance"
        refId={pmId ?? null}
        disabled={disabled}
        onBusyChange={setAttachmentBusy}
        onError={setError}
        onAttachmentIdChange={(attachmentId) =>
          setForm((current) => ({ ...current, attachmentId }))
        }
      />
      {document && (
        <div className="text-xs text-slate-500">
          등록자: {document.createdBy} / 등록일시: {document.createdAt} /
          수정자: {document.updatedBy || '-'} / 수정일시:{' '}
          {document.updatedAt || '-'}
        </div>
      )}
    </form>
  )
}
