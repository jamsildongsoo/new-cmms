import { AxiosError } from 'axios'
import { Edit3, Plus, RefreshCw, Save, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createCompany,
  getCompany,
  updateCompany,
  type Company,
} from '../api/companies.api'
import { Button } from '../components/ui/Button'
import { DataTable } from '../components/ui/DataTable'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'

interface CompanyFormState {
  name: string
  registrationNumber: string
  note: string
}

const emptyForm: CompanyFormState = {
  name: '',
  registrationNumber: '',
  note: '',
}

function toForm(company: Company): CompanyFormState {
  return {
    name: company.name,
    registrationNumber: company.registrationNumber ?? '',
    note: company.note ?? '',
  }
}

function toMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { message?: unknown } | undefined)
      ?.message
    if (Array.isArray(message)) {
      return message.join(', ')
    }
    if (typeof message === 'string') {
      return message
    }
  }
  return 'Request failed'
}

export function CompaniesPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [form, setForm] = useState<CompanyFormState>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadCompany = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const data = await getCompany()
      setCompany(data)
    } catch (loadError) {
      if (
        loadError instanceof AxiosError &&
        loadError.response?.status === 404
      ) {
        setCompany(null)
        setNotice('No company master data found')
      } else {
        setError(toMessage(loadError))
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCompany()
  }, [loadCompany])

  const rows = useMemo(() => (company ? [company] : []), [company])

  const openNewForm = () => {
    setForm(emptyForm)
    setIsFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const openEditForm = () => {
    if (!company) {
      openNewForm()
      return
    }
    setForm(toForm(company))
    setIsFormOpen(true)
    setError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    setForm(emptyForm)
  }

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setNotice(null)

    const payload = {
      name: form.name,
      registrationNumber: form.registrationNumber,
      note: form.note,
    }

    try {
      const savedCompany = company
        ? await updateCompany(payload)
        : await createCompany(payload)
      setCompany(savedCompany)
      setIsFormOpen(false)
      setNotice(company ? 'Company updated' : 'Company created')
    } catch (saveError) {
      setError(toMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Companies</h1>
          <p className="text-xs text-slate-500">
            Company master data for the current tenant
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => void loadCompany()}
            disabled={isLoading || isSaving}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {company ? (
            <Button onClick={openEditForm} disabled={isLoading || isSaving}>
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>
          ) : (
            <Button onClick={openNewForm} disabled={isLoading || isSaving}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          )}
        </div>
      </div>

      {(error || notice) && (
        <div
          className={[
            'border px-3 py-2 text-xs',
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          ].join(' ')}
        >
          {error ?? notice}
        </div>
      )}

      {isFormOpen && (
        <form
          className="border border-slate-200 bg-white p-3"
          onSubmit={(event) => void saveCompany(event)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company Name" required>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                autoFocus
              />
            </Field>
            <Field label="Registration Number">
              <Input
                value={form.registrationNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    registrationNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Note" className="md:col-span-2">
              <Textarea
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </form>
      )}

      <DataTable<Company>
        gridTemplateColumns="140px 1fr 180px 100px"
        columns={[
          { key: 'companyId', label: 'Company ID', render: (row) => row.companyId },
          { key: 'name', label: 'Name', render: (row) => row.name },
          {
            key: 'registrationNumber',
            label: 'Registration No.',
            render: (row) => row.registrationNumber ?? '-',
          },
          { key: 'status', label: 'Status', render: (row) => row.deleteYn },
        ]}
        rows={rows}
        emptyText={isLoading ? 'Loading...' : 'No company data'}
      />
    </section>
  )
}
