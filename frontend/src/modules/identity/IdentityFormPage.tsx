// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useMetadata } from '@/shared/metadata/metadata'

import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import type { FormMode } from '@/shared/types/form'
import { printDocument } from '@/shared/lib/print'
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { configs } from './identityConfig'
import {
  createRecord,
  deleteRecord,
  getRecord,
  updateRecord,
  getUserOptions,
  getRolePermissionOptions,
  getRolePermissions,
  updateRolePermissions,
  type Resource,
  type Choice,
  type UserOptions,
  type IdentityRow,
  type PermissionOption,
} from './identity.api'

export function IdentityFormPage({
  resource,
  mode,
}: {
  resource: Resource
  mode: FormMode
}) {
  const metadata = useMetadata()
  const permissionColumns = metadata.permissionActions.map(
    ({ value, label }) => ({ action: value, label }),
  )
  const config = configs[resource]
  const id = useParams().id
  const location = useLocation()
  const navigate = useNavigate()
  const pendingRolePermissions = location.state as {
    roleId?: string
    permissionIds?: string[]
    error?: string
  } | null
  const { hasPermission } = useAuth()
  const [form, setForm] = useState<Record<string, string>>({
    accessScope: 'OWN_DEPARTMENT',
  })
  const [options, setOptions] = useState<UserOptions>({
    sites: [],
    departments: [],
    roles: [],
  })
  const [original, setOriginal] = useState<IdentityRow>({})
  const [permissions, setPermissions] = useState<PermissionOption[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(
    pendingRolePermissions?.roleId === id
      ? pendingRolePermissions?.error ?? null
      : null,
  )
  const readOnly =
    mode !== 'create' && !hasPermission(`${config.permission}:update`)
  const [baseline, setBaseline] = useState('')
  const confirmLeave = useUnsavedChanges(
    Boolean(baseline) &&
      baseline !== JSON.stringify([form, selectedPermissions]),
  )

  useEffect(() => {
    let active = true
    async function load() {
      const [row, userOptions, availablePermissions, assignedPermissions] =
        await Promise.all([
          mode !== 'create' && id ? getRecord(resource, id) : null,
          resource === 'users' ? getUserOptions() : null,
          resource === 'roles' ? getRolePermissionOptions() : [],
          resource === 'roles' && mode !== 'create' && id
            ? getRolePermissions(id)
            : [],
        ])
      if (!active) return
      if (row) {
        setOriginal(row)
        setForm(
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              value == null ? '' : String(value),
            ]),
          ),
        )
      }
      if (userOptions) setOptions(userOptions)
      setPermissions(availablePermissions)
      const retryPermissions =
        resource === 'roles' &&
        mode === 'edit' &&
        pendingRolePermissions?.roleId === id
          ? pendingRolePermissions?.permissionIds
          : undefined
      setSelectedPermissions(retryPermissions ?? assignedPermissions)
      const loadedForm = row
        ? Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              value == null ? '' : String(value),
            ]),
          )
        : { accessScope: 'OWN_DEPARTMENT' }
      setBaseline(JSON.stringify([loadedForm, assignedPermissions]))
    }
    void load()
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [resource, mode, id, pendingRolePermissions?.roleId, pendingRolePermissions?.permissionIds])

  const action =
    mode === 'create' ? 'create' : mode === 'edit' ? 'update' : 'read'
  if (!hasPermission(`${config.permission}:${action}`))
    return <Navigate to={`/${resource}`} replace />
  if (loading) return <p className="text-xs text-slate-500">불러오는 중…</p>

  async function save(event: FormEvent) {
    event.preventDefault()
    if (readOnly || saving) return
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, string | null> = {}
      for (const field of config.fields) {
        if (mode !== 'create' && field.key === config.idKey) continue
        if (field.key === 'password' && mode !== 'create' && !form.password)
          continue
        const value = form[field.key] ?? ''
        payload[field.key] =
          resource === 'users' &&
          !field.required &&
          field.key !== 'password' &&
          !value
            ? null
            : value
      }
      const saved =
        mode === 'create'
          ? await createRecord(resource, payload)
          : await updateRecord(resource, id!, payload)
      const savedId = String(saved[config.idKey])
      if (resource === 'roles' && hasPermission('ROLE:update')) {
        try {
          await updateRolePermissions(savedId, selectedPermissions)
        } catch (permissionError) {
          if (mode === 'create') {
            navigate(`/roles/${encodeURIComponent(savedId)}/edit`, {
              replace: true,
              state: {
                roleId: savedId,
                permissionIds: selectedPermissions,
                error: `역할은 생성됐지만 권한 저장에 실패했습니다. 권한을 확인하고 다시 저장해 주세요. ${toMessage(permissionError)}`,
              },
            })
            return
          }
          throw permissionError
        }
      }
      setBaseline(JSON.stringify([form, selectedPermissions]))
      setSaving(false)
      navigate(`/${resource}/${encodeURIComponent(savedId)}`, {
        replace: mode === 'create',
      })
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }

  async function remove() {
    if (
      !id ||
      saving ||
      !hasPermission(`${config.permission}:delete`) ||
      !window.confirm('이 정보를 삭제하시겠습니까?')
    )
      return
    setSaving(true)
    try {
      await deleteRecord(resource, id)
      navigate(`/${resource}`)
    } catch (e) {
      setError(toMessage(e))
      setSaving(false)
    }
  }

  function choices(key: string): Choice[] | null {
    if (resource !== 'users') return null
    if (key === 'siteId') return options.sites
    if (key === 'deptId') return options.departments
    if (key === 'roleId') return options.roles
    if (key === 'accessScope')
      return metadata.accessScopes.map(({ value, label }) => ({
        id: value,
        name: label,
      }))
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{config.title}</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              if (confirmLeave()) navigate(`/${resource}`)
            }}
          >
            목록
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mode === 'create' || saving}
            onClick={() =>
              printDocument({
                title: config.title,
                fields: config.fields
                  .filter((field) => field.key !== 'password')
                  .map((field) => [field.label, form[field.key]]),
              })
            }
          >
            인쇄
          </Button>
          {mode !== 'create' &&
            hasPermission(`${config.permission}:delete`) && (
              <Button
                className="sm:ml-2"
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void remove()}
              >
                삭제
              </Button>
            )}
          {!readOnly && (
            <Button
              type="submit"
              form="identity-form"
              disabled={
                saving ||
                Boolean(error && mode !== 'create' && !original[config.idKey])
              }
            >
              저장
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <form
        id="identity-form"
        onSubmit={(event) => void save(event)}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {config.fields
            .filter((field) => !(readOnly && field.key === 'password'))
            .map((field) => {
              const selected = choices(field.key)
              const value = form[field.key] ?? ''
              const required =
                field.required ||
                (field.key === 'password' && mode === 'create')
              const disabled =
                readOnly ||
                saving ||
                (field.key === config.idKey && mode !== 'create')
              return (
                <Field key={field.key} label={field.label} required={required}>
                  {selected ? (
                    <Select
                      value={value}
                      required={required}
                      disabled={disabled}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: e.target.value,
                        }))
                      }
                    >
                      <option value="">선택 {field.label}</option>

                      {selected.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.id} · {row.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={field.type ?? 'text'}
                      value={value}
                      required={required}
                      disabled={disabled}
                      autoComplete={
                        field.key === 'password' ? 'new-password' : undefined
                      }
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                </Field>
              )
            })}
        </div>
        {resource === 'roles' && (
          <fieldset
            disabled={readOnly || saving || !hasPermission('ROLE:update')}
            className="space-y-2"
          >
            <legend className="text-sm font-semibold">권한 관리</legend>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">모듈별 역할 권한</caption>
                <thead>
                  <tr className="border-b border-slate-200">
                    <th scope="col" className="px-3 py-2 text-left">
                      모듈
                    </th>
                    {permissionColumns.map(({ action, label }) => (
                      <th
                        key={action}
                        scope="col"
                        className="px-3 py-2 text-center"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...new Set(
                      permissions.map((permission) =>
                        String(permission.module),
                      ),
                    ),
                  ].map((module) => {
                    const label =
                      permissions.find((p) => p.module === module)
                        ?.moduleLabel ?? module
                    return (
                      <tr key={module} className="border-b border-slate-100">
                        <th
                          scope="row"
                          className="px-3 py-2 text-left font-medium"
                        >
                          {label}
                        </th>
                        {permissionColumns.map(
                          ({ action, label: actionLabel }) => {
                            const permission = permissions.find(
                              (item) =>
                                item.module === module &&
                                item.action === action,
                            )
                            const code = permission
                              ? String(permission.permissionId)
                              : null
                            return (
                              <td
                                key={action}
                                className="px-3 py-2 text-center"
                              >
                                {code ? (
                                  <input
                                    type="checkbox"
                                    aria-label={`${label} ${actionLabel}`}
                                    checked={selectedPermissions.includes(code)}
                                    onChange={(e) =>
                                      setSelectedPermissions((current) =>
                                        e.target.checked
                                          ? [...current, code]
                                          : current.filter(
                                              (item) => item !== code,
                                            ),
                                      )
                                    }
                                  />
                                ) : (
                                  <span aria-label="지원하지 않는 동작">—</span>
                                )}
                              </td>
                            )
                          },
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedPermissions
              .filter(
                (code) => !permissions.some((row) => row.permissionId === code),
              )
              .map((code) => (
                <p key={code} className="text-xs text-slate-500">
                  {code} (사용 중지)
                </p>
              ))}
          </fieldset>
        )}
      </form>
    </section>
  )
}
