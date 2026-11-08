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
  const editing = hasPermission('company:update')
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
    if (!company || !editing || isSaving || !hasPermission('company:update'))
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
      setNotice('Company updated')
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">회사 정보</h1>
        <div className="flex gap-2">
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
        Company code is managed during setup. Company information can be edited
        here.
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
          className="space-y-3 border border-slate-200 bg-white p-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company ID">
              <Input value={company.companyId} disabled />
            </Field>
            <Field label="Company Name" required>
              <Input
                required
                value={company.name}
                disabled={!editing || isSaving}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <Field label="Registration Number">
              <Input
                value={company.registrationNumber ?? ''}
                disabled={!editing || isSaving}
                onChange={(e) => update('registrationNumber', e.target.value)}
              />
            </Field>
            <Field label="Contact Name">
              <Input
                value={company.contactName ?? ''}
                maxLength={100}
                disabled={!editing || isSaving}
                onChange={(e) => update('contactName', e.target.value)}
              />
            </Field>
            <Field label="Phone Number">
              <Input
                value={company.phoneNumber ?? ''}
                maxLength={50}
                disabled={!editing || isSaving}
                onChange={(e) => update('phoneNumber', e.target.value)}
              />
            </Field>
            <Field label="Note" className="md:col-span-2">
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
