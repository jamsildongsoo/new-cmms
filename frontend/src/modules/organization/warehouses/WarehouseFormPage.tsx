// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  createWarehouse,
  getWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from './warehouses.api'
import { useAuth } from '@/modules/auth'
import { printDocument } from '@/shared/lib/print'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { getSites, type Site } from '../sites/sites.api'
import type { FormMode } from '@/shared/types/form'

interface WarehouseFormState {
  warehouseId: string
  name: string
  siteId: string
}

const emptyForm: WarehouseFormState = { warehouseId: '', name: '', siteId: '' }

export function WarehouseFormPage({ mode }: { mode: FormMode }) {
  const { siteId, warehouseId } = useParams()
  return (
    <WarehouseEditor
      key={`${mode}:${siteId ?? ''}:${warehouseId ?? ''}`}
      mode={mode}
      siteId={siteId}
      id={warehouseId}
    />
  )
}
function WarehouseEditor({
  mode,
  siteId,
  id,
}: {
  mode: FormMode
  siteId?: string
  id?: string
}) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()

  const [form, setForm] = useState<WarehouseFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [sites, setSites] = useState<Site[]>([])
  const [error, setError] = useState<string | null>(null)

  const [savedForm, setSavedForm] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getSites()
      .then((rows) => {
        if (active) setSites(rows)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (mode === 'create' || !id || !siteId) {
      return
    }
    let active = true
    getWarehouse(siteId!, id)
      .then((row) => {
        if (active) {
          const loaded = {
            warehouseId: row.warehouseId,
            name: row.name,
            siteId: row.siteId,
          }
          setForm(loaded)
          setSavedForm(JSON.stringify(loaded))
        }
      })
      .catch((loadError) => active && setError(toMessage(loadError)))
      .finally(() => active && setIsLoading(false))
    return () => {
      active = false
    }
  }, [mode, id, siteId])

  const dirty =
    savedForm === null
      ? mode === 'create' && JSON.stringify(form) !== JSON.stringify(emptyForm)
      : JSON.stringify(form) !== savedForm
  const confirmLeave = useUnsavedChanges(dirty)

  const requiredPermission =
    mode === 'create'
      ? 'WHSE:create'
      : mode === 'edit'
        ? 'WHSE:update'
        : 'WHSE:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/warehouses" replace />
  }

  const readOnly = mode !== 'create' && !hasPermission('WHSE:update')

  const update = (key: keyof WarehouseFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSaving || isLoading) return
    setIsSaving(true)
    setError(null)
    try {
      const saved =
        mode !== 'create' && id && siteId
          ? await updateWarehouse(siteId, id, { name: form.name })
          : await createWarehouse({
              warehouseId: form.warehouseId.trim(),
              siteId: form.siteId,
              name: form.name,
            })
      const loaded = {
        warehouseId: saved.warehouseId,
        siteId: saved.siteId,
        name: saved.name,
      }
      setForm(loaded)
      setSavedForm(JSON.stringify(loaded))
      navigate(
        `/warehouses/${encodeURIComponent(saved.siteId)}/${encodeURIComponent(saved.warehouseId)}`,
        { replace: mode === 'create' },
      )
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (
      !id ||
      !siteId ||
      isLoading ||
      isSaving ||
      !hasPermission('WHSE:delete') ||
      !window.confirm(
        '삭제 전 이 창고의 현재고 수량·금액과 수령 대기 입고가 없는지 확인하세요. 삭제 후에는 이 창고로 대기 중인 입고를 확정할 수 없습니다. 확인하고 삭제하시겠습니까?',
      )
    )
      return
    setIsSaving(true)
    try {
      await deleteWarehouse(siteId!, id)
      navigate('/warehouses')
    } catch (error) {
      setError(toMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">창고</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              if (confirmLeave()) navigate('/warehouses')
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
                title: '창고',
                fields: [
                  ['창고번호', form.warehouseId],
                  ['창고명', form.name],
                  ['사업장코드', form.siteId],
                ],
              })
            }
          >
            인쇄
          </Button>
          {mode !== 'create' && hasPermission('WHSE:delete') && (
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
              form="warehouses-form"
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
        id="warehouses-form"
        className="rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="창고번호" required>
            <Input
              value={form.warehouseId}
              required
              maxLength={30}
              disabled={mode !== 'create' || isLoading || isSaving}
              onChange={(event) => update('warehouseId', event.target.value)}
            />
          </Field>
          <Field label="창고명" required>
            <Input
              value={form.name}
              required
              maxLength={100}
              disabled={readOnly || isLoading || isSaving}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
          <Field label="사업장" required>
            <Select
              value={form.siteId}
              required
              disabled={mode !== 'create' || isLoading || isSaving}
              onChange={(event) => update('siteId', event.target.value)}
            >
              <option value="">사업장 선택</option>

              {sites.map((site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.siteId} · {site.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </section>
  )
}
