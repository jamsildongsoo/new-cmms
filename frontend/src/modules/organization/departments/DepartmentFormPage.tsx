// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toMessage } from '@/shared/api/errors'
import {
  createDepartment,
  getDepartment,
  getDepartments,
  type Department,
  updateDepartment,
  deleteDepartment,
} from './departments.api'
import { useAuth } from '@/modules/auth'
import { printDocument } from '@/shared/lib/print'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import type { FormMode } from '@/shared/types/form'

interface DepartmentFormState {
  deptId: string
  name: string
  parentDeptId: string
}

const emptyForm: DepartmentFormState = {
  deptId: '',
  name: '',
  parentDeptId: '',
}

export function DepartmentFormPage({ mode }: { mode: FormMode }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const id = useParams().deptId

  const [form, setForm] = useState<DepartmentFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(mode !== 'create')
  const [isSaving, setIsSaving] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<string | null>(null)

  const [savedForm, setSavedForm] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getDepartments()
      .then((rows) => {
        if (active) setDepartments(rows)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (mode === 'create' || !id) {
      return
    }
    let active = true
    getDepartment(id)
      .then((row) => {
        if (active) {
          const loaded = {
            deptId: row.deptId,
            name: row.name,
            parentDeptId: row.parentDeptId ?? '',
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
  }, [mode, id])

  const dirty =
    savedForm === null
      ? mode === 'create' && JSON.stringify(form) !== JSON.stringify(emptyForm)
      : JSON.stringify(form) !== savedForm
  const confirmLeave = useUnsavedChanges(dirty)

  const requiredPermission =
    mode === 'create'
      ? 'DEPT:create'
      : mode === 'edit'
        ? 'DEPT:update'
        : 'DEPT:read'
  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/departments" replace />
  }

  const readOnly = mode !== 'create' && !hasPermission('DEPT:update')

  const update = (key: keyof DepartmentFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSaving || isLoading) return
    setIsSaving(true)
    setError(null)
    try {
      const saved =
        mode !== 'create' && id
          ? await updateDepartment(id, {
              name: form.name,
              parentDeptId: form.parentDeptId,
            })
          : await createDepartment({ ...form })
      const loaded = {
        deptId: saved.deptId,
        name: saved.name,
        parentDeptId: saved.parentDeptId ?? '',
      }
      setForm(loaded)
      setSavedForm(JSON.stringify(loaded))
      navigate(`/departments/${encodeURIComponent(saved.deptId)}`, {
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
      !hasPermission('DEPT:delete') ||
      !window.confirm('이 정보를 삭제하시겠습니까?')
    )
      return
    setIsSaving(true)
    try {
      await deleteDepartment(id)
      navigate('/departments')
    } catch (error) {
      setError(toMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">부서</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              if (confirmLeave()) navigate('/departments')
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
                title: '부서',
                fields: [
                  ['부서코드', form.deptId],
                  ['부서명', form.name],
                  ['상위 부서', form.parentDeptId],
                ],
              })
            }
          >
            인쇄
          </Button>
          {mode !== 'create' && hasPermission('DEPT:delete') && (
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
              form="departments-form"
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
        id="departments-form"
        className="rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        onSubmit={(event) => void save(event)}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="부서코드" required>
            <Input
              value={form.deptId}
              required
              maxLength={30}
              disabled={mode !== 'create' || isLoading}
              onChange={(event) => update('deptId', event.target.value)}
            />
          </Field>
          <Field label="부서명" required>
            <Input
              value={form.name}
              required
              maxLength={100}
              disabled={readOnly || isLoading}
              onChange={(event) => update('name', event.target.value)}
            />
          </Field>
          <Field label="상위 부서">
            <Select
              value={form.parentDeptId}
              disabled={readOnly || isLoading}
              onChange={(event) => update('parentDeptId', event.target.value)}
            >
              <option value="">상위 항목 없음</option>

              {departments
                .filter((row) => row.deptId !== form.deptId)
                .map((row) => (
                  <option key={row.deptId} value={row.deptId}>
                    {row.deptId} · {row.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      </form>
    </section>
  )
}
