import { DecimalInput } from '@/shared/ui/DecimalInput'
import { CodeSelect } from '@/shared/ui/CodeSelect'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { amount, money, totals, type WorkOrderForm, type LaborRow, type MaterialRow, type CostRow } from './workOrderForm'

interface Column<T> {
  key: keyof T
  label: string
  numeric?: boolean
  step?: string
  choices?: { value: string; label: string }[]
  maxLength?: number
}
function DetailTable<T extends object>({
  title,
  rows,
  columns,
  empty,
  onChange,
  readOnly,
  disabled,
  extra,
}: {
  title: string
  rows: T[]
  columns: Column<T>[]
  empty: T
  onChange: (rows: T[]) => void
  readOnly: boolean
  disabled: boolean
  extra?: (row: T) => string
}) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {!readOnly && (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => onChange([...rows, { ...empty }])}
          >
            {title} 추가
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className="bg-slate-50 p-2 text-left"
                >
                  {column.label}
                </th>
              ))}
              {extra && <th className="bg-slate-50 p-2 text-right">금액</th>}
              {!readOnly && (
                <th className="bg-slate-50 p-2">
                  <span className="sr-only">행 삭제</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length + Number(Boolean(extra)) + Number(!readOnly)
                  }
                  className="border p-3 text-center text-slate-500"
                >
                  등록된 내역이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column, col) => (
                    <td
                      key={String(column.key)}
                      className="min-w-24 border p-1"
                    >
                      {column.choices ? (
                        <CodeSelect
                          aria-label={`${title} ${index + 1}행 ${column.label}`}
                          options={column.choices}
                          value={String(row[column.key])}
                          disabled={disabled || readOnly}
                          onChange={(event) =>
                            onChange(
                              rows.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      [column.key]: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : column.key === 'quantity' ||
                        column.key === 'unitPrice' ? (
                        <DecimalInput
                          kind={
                            column.key === 'quantity' ? 'quantity' : 'unitPrice'
                          }
                          aria-label={`${title} ${index + 1}행 ${column.label}`}
                          required
                          value={String(row[column.key])}
                          disabled={disabled || readOnly}
                          onChange={(e) =>
                            onChange(
                              rows.map((item, i) =>
                                i === index
                                  ? { ...item, [column.key]: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      ) : (
                        <Input
                          aria-label={`${title} ${index + 1}행 ${column.label}`}
                          type={column.numeric ? 'number' : 'text'}
                          min={column.numeric ? 0 : undefined}
                          step={
                            column.numeric
                              ? (column.step ?? '0.0001')
                              : undefined
                          }
                          maxLength={column.maxLength}
                          required={col === 0 || column.numeric}
                          value={String(row[column.key])}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(
                              rows.map((item, i) =>
                                i === index
                                  ? { ...item, [column.key]: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      )}
                    </td>
                  ))}
                  {extra && (
                    <td className="whitespace-nowrap border p-2 text-right">
                      {extra(row)}
                    </td>
                  )}
                  {!readOnly && (
                    <td className="border p-1">
                      <Button
                        type="button"
                        variant="danger"
                        disabled={disabled}
                        aria-label={`${title} ${index + 1}행 삭제`}
                        onClick={() =>
                          onChange(rows.filter((_, i) => i !== index))
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
  )
}

export function WorkOrderDetails({
  form,
  setForm,
  readOnly,
  disabled,
  units,
}: {
  units: { value: string; label: string }[]
  form: WorkOrderForm
  setForm: Dispatch<SetStateAction<WorkOrderForm>>
  readOnly: boolean
  disabled: boolean
}) {
  const sum = totals(form)
  return (
    <div className="space-y-4">
      <DetailTable<LaborRow>
        title="공수"
        rows={form.laborItems}
        empty={{ workerName: '', content: '', hours: '' }}
        columns={[
          { key: 'workerName', label: '작업자명', maxLength: 100 },
          { key: 'content', label: '작업 내용' },
          { key: 'hours', label: '시간', numeric: true },
        ]}
        onChange={(laborItems) =>
          setForm((current) => ({ ...current, laborItems }))
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <p className="text-right text-xs">총 공수: {sum.totalHours}시간</p>
      <DetailTable<MaterialRow>
        title="자재"
        rows={form.materials}
        empty={{ name: '', spec: '', quantity: '', unit: '', unitPrice: '' }}
        columns={[
          { key: 'name', label: '자재명', maxLength: 150 },
          { key: 'spec', label: '규격', maxLength: 200 },
          { key: 'quantity', label: '수량', numeric: true },
          { key: 'unit', label: '단위', choices: units },
          { key: 'unitPrice', label: '단가', numeric: true },
        ]}
        extra={(r) => money(amount(r.quantity, r.unitPrice))}
        onChange={(materials) =>
          setForm((current) => ({ ...current, materials }))
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <p className="text-right text-xs">자재비: {money(sum.materialTotal)}원</p>
      <DetailTable<CostRow>
        title="기타 비용"
        rows={form.costItems}
        empty={{ name: '', amount: '', note: '' }}
        columns={[
          { key: 'name', label: '비용 항목', maxLength: 150 },
          { key: 'amount', label: '금액', numeric: true, step: '1' },
          { key: 'note', label: '비고' },
        ]}
        onChange={(costItems) =>
          setForm((current) => ({ ...current, costItems }))
        }
        readOnly={readOnly}
        disabled={disabled}
      />
      <p className="text-right text-xs">기타 비용: {money(sum.costTotal)}원</p>
      <p className="text-right text-sm font-semibold">
        총 비용: {money(sum.totalCost)}원 (원화, 부가세 제외)
      </p>
    </div>
  )
}
