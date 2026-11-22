import { DecimalInput } from '@/shared/ui/DecimalInput'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Textarea } from '@/shared/ui/Textarea'
import { Select } from '@/shared/ui/Select'
import type { InventoryItem, InventoryOptions } from './inventory.api'
import type { InventoryType, InventoryKind } from '../inventory.constant'

export function InventoryItems({
  items,
  setItems,
  options,
  disabled,
  readonly,
  linked,
  type,
  kind,
}: {
  items: InventoryItem[]
  setItems: Dispatch<SetStateAction<InventoryItem[]>>
  options: Pick<InventoryOptions, 'materials'>
  disabled: boolean
  readonly: boolean
  linked: boolean
  type: InventoryType
  kind: InventoryKind | null
}) {
  return (
    <section className="space-y-2">
      <div className="flex justify-between">
        <h2 className="text-base font-semibold">품목</h2>
        {!readonly && !linked && (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              setItems((rows) => [
                ...rows,
                {
                  itemId: crypto.randomUUID(),
                  materialId: '',
                  materialName: '',
                  spec: null,
                  baseUnit: '',
                  quantity: '1',
                  unitPrice: '0',
                  amount: '0',
                  refItemId: null,
                  note: null,
                },
              ])
            }
          >
            품목 추가
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr>
              {['자재', '규격', '단위', '수량', '단가', '금액', '적요', ''].map(
                (label, i) => (
                  <th key={i} className="bg-slate-50 p-2">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const update = (key: keyof InventoryItem, value: string) =>
                setItems((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, [key]: value } : r,
                  ),
                )
              const inputPrice = type === 'IN' && kind === 'GENERAL'
              return (
                <tr key={item.itemId}>
                  <td className="border p-1">
                    <Select
                      required
                      aria-label={`${index + 1}행 자재`}
                      disabled={disabled || linked}
                      value={item.materialId}
                      onChange={(e) => {
                        const m = options.materials.find(
                          (m) => m.materialId === e.target.value,
                        )
                        if (m)
                          setItems((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    materialId: m.materialId,
                                    materialName: m.name,
                                    spec: m.spec,
                                    baseUnit: m.baseUnit,
                                  }
                                : r,
                            ),
                          )
                      }}
                    >
                      <option value="">선택</option>
                      {options.materials.map((m) => (
                        <option key={m.materialId} value={m.materialId}>
                          {m.materialId} / {m.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="border p-1">{item.spec}</td>
                  <td className="border p-1">{item.baseUnit}</td>
                  <td className="border p-1">
                    <DecimalInput
                      kind="quantity"
                      signed={type === 'ADJUST'}
                      required
                      aria-label={`${index + 1}행 수량`}
                      disabled={disabled || linked}
                      value={item.quantity}
                      onChange={(e) => update('quantity', e.target.value)}
                    />
                  </td>
                  <td className="border p-1">
                    <DecimalInput
                      kind="unitPrice"
                      aria-label={`${index + 1}행 단가`}
                      disabled={disabled || !inputPrice}
                      value={item.unitPrice}
                      onChange={(e) => update('unitPrice', e.target.value)}
                    />
                  </td>
                  <td className="border p-1">
                    {type === 'ADJUST' && !readonly ? (
                      <Input
                        required
                        inputMode="numeric"
                        aria-label={`${index + 1}행 금액`}
                        disabled={disabled}
                        value={item.amount}
                        onChange={(e) => {
                          if (/^-?\d*$/.test(e.target.value))
                            update('amount', e.target.value)
                        }}
                      />
                    ) : readonly ? (
                      item.amount
                    ) : (
                      '확정 시 계산'
                    )}
                  </td>
                  <td className="border p-1">
                    <Textarea
                      rows={3}
                      aria-label={`${index + 1}행 적요`}
                      disabled={disabled}
                      value={item.note ?? ''}
                      onChange={(e) => update('note', e.target.value)}
                    />
                  </td>
                  <td className="border p-1">
                    {!readonly && !linked && (
                      <Button
                        type="button"
                        variant="danger"
                        disabled={disabled}
                        onClick={() =>
                          setItems((rows) => rows.filter((_, i) => i !== index))
                        }
                      >
                        삭제
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!items.length && (
              <tr>
                <td colSpan={8} className="border p-3 text-center">
                  등록된 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
