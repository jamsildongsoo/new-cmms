import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
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
} from './identity.api'

export function IdentityFormPage({
  resource,
  mode,
}: {
  resource: Resource
  mode: FormMode
}) {
  const config = configs[resource]
  const id = useParams().id
  const navigate = useNavigate()
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
  const [permissions, setPermissions] = useState<IdentityRow[]>([])
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setSelectedPermissions(assignedPermissions)
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
  }, [resource, mode, id])

  const action =
    mode === 'create' ? 'create' : mode === 'edit' ? 'update' : 'read'
  if (!hasPermission(`${config.permission}:${action}`))
    return <Navigate to={`/${resource}`} replace />
  if (loading) return <p className="text-xs text-slate-500">Loading...</p>

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
      if (resource === 'roles' && hasPermission('role:update')) {
        await updateRolePermissions(savedId, selectedPermissions)
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
      return [
        { id: 'OWN_DEPARTMENT', name: 'Own department and sub-departments' },
        { id: 'OWN_SITE', name: 'Own site' },
        { id: 'COMPANY_ALL', name: 'Company all' },
      ]
    return null
  }
  function savedReferenceName(key: string) {
    if (key === 'siteId') return original.siteName
    if (key === 'deptId') return original.deptName
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">{config.title}</h1>
        <div className="flex flex-wrap justify-end gap-2">
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
          {mode !== 'create' &&
            hasPermission(`${config.permission}:delete`) && (
              <Button
                type="button"
                variant="danger"
                disabled={saving}
                onClick={() => void remove()}
              >
                삭제
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
        className="space-y-3 border border-slate-200 bg-white p-3"
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
                      <option value="">Select {field.label}</option>
                      {/* 삭제된 기준정보도 기존 연결값은 그대로 유지한다. */}
                      {value && !selected.some((row) => row.id === value) && (
                        <option value={value}>
                          {value}
                          {savedReferenceName(field.key)
                            ? ` · ${savedReferenceName(field.key)}`
                            : ''}{' '}
                          (inactive)
                        </option>
                      )}
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
            disabled={readOnly || saving || !hasPermission('role:update')}
            className="space-y-2"
          >
            <legend className="text-sm font-semibold">Permissions</legend>
            {permissions.map((permission) => {
              const code = String(permission.permissionId)
              return (
                <label key={code} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(code)}
                    onChange={(e) =>
                      setSelectedPermissions((current) =>
                        e.target.checked
                          ? [...current, code]
                          : current.filter((item) => item !== code),
                      )
                    }
                  />
                  {code} · {String(permission.name)}
                </label>
              )
            })}
            {selectedPermissions
              .filter(
                (code) => !permissions.some((row) => row.permissionId === code),
              )
              .map((code) => (
                <p key={code} className="text-xs text-slate-500">
                  {code} (inactive)
                </p>
              ))}
          </fieldset>
        )}
      </form>
    </section>
  )
}
