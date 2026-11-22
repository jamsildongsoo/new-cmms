// 모듈·권한 원본: backend/src/common/constants/modules.ts (MODULES), backend/src/common/constants/permissions.ts (MODULE_ACTIONS).
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/modules/auth'
import { toMessage } from '@/shared/api/errors'
import { printDocument } from '@/shared/lib/print'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { getCompany, updateCompany, type Company } from './companies.api'

export function CompaniesPage() {
  const { hasPermission } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const editing = hasPermission('COMP:update')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getCompany()
      .then((row) => {
        if (active) setCompany(row)
      })
      .catch((e) => {
        if (active) setError(toMessage(e))
      })
    return () => {
      active = false
    }
  }, [])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!company || !editing || isSaving || !hasPermission('COMP:update'))
      return
    setIsSaving(true)
    setError(null)
    try {
      const { name, registrationNumber, contactName, phoneNumber, note } =
        company
      setCompany(
        await updateCompany({
          name,
          registrationNumber,
          contactName,
          phoneNumber,
          note,
        }),
      )
      setNotice('회사 정보를 저장했습니다.')
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setIsSaving(false)
    }
  }

  const update = (key: keyof Company, value: string) =>
    setCompany((current) => (current ? { ...current, [key]: value } : current))

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">회사 정보</h1>
        <div className="page-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!company || isSaving}
            onClick={() =>
              company &&
              printDocument({
                title: '회사 정보',
                fields: [
                  ['회사코드', company.companyId],
                  ['회사명', company.name],
                  ['사업자번호', company.registrationNumber],
                  ['담당자', company.contactName],
                  ['연락처', company.phoneNumber],
                  ['비고', company.note],
                ],
              })
            }
          >
            인쇄
          </Button>
          {editing && (
            <Button
              type="submit"
              form="company-form"
              disabled={!company || isSaving}
            >
              저장
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        회사 코드는 초기 설정에서 관리합니다. 이 화면에서는 회사 정보를 수정할
        수 있습니다.
      </p>
      {error && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      {notice && <p className="text-xs text-emerald-700">{notice}</p>}
      {company && (
        <form
          id="company-form"
          onSubmit={(event) => void save(event)}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 md:p-5"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="회사코드">
              <Input value={company.companyId} disabled />
            </Field>
            <Field label="회사명" required>
              <Input
                required
                value={company.name}
                maxLength={100}
                disabled={!editing || isSaving}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <Field label="사업자등록번호">
              <Input
                value={company.registrationNumber ?? ''}
                maxLength={50}
                disabled={!editing || isSaving}
                onChange={(e) => update('registrationNumber', e.target.value)}
              />
            </Field>
            <Field label="담당자명">
              <Input
                value={company.contactName ?? ''}
                maxLength={100}
                disabled={!editing || isSaving}
                onChange={(e) => update('contactName', e.target.value)}
              />
            </Field>
            <Field label="전화번호">
              <Input
                value={company.phoneNumber ?? ''}
                maxLength={50}
                disabled={!editing || isSaving}
                onChange={(e) => update('phoneNumber', e.target.value)}
              />
            </Field>
            <Field label="비고" className="md:col-span-2">
              <Textarea
                value={company.note ?? ''}
                disabled={!editing || isSaving}
                onChange={(e) => update('note', e.target.value)}
              />
            </Field>
          </div>
        </form>
      )}
    </section>
  )
}
