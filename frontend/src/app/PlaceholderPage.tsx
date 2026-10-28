import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/ui/DataTable'

interface PlaceholderPageProps {
  title: string
}

interface PlaceholderRow {
  id: string
  name: string
  status: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">
            Function-test page placeholder
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 bg-white p-3">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Search</h2>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-1 h-8 border border-dashed border-slate-300 bg-slate-50" />
          <div className="col-span-2 h-8 border border-dashed border-slate-300 bg-slate-50" />
        </div>
      </div>

      <DataTable<PlaceholderRow>
        gridTemplateColumns="160px 1fr 140px"
        columns={[
          { key: 'id', label: 'ID', render: (row) => row.id },
          { key: 'name', label: 'Name', render: (row) => row.name },
          { key: 'status', label: 'Status', render: (row) => row.status },
        ]}
        rows={[]}
      />
    </section>
  )
}
