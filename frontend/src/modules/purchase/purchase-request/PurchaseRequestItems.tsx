import { DecimalInput } from '@/shared/ui/DecimalInput'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import type {
  PurchaseRequestItem,
  PurchaseRequestOptions,
} from './purchase-request.api'

export function PurchaseRequestItems({
  items,
  setItems,
  options,
  disabled,
  readOnly,
  blocked,
}: {
  items: PurchaseRequestItem[]
  setItems: Dispatch<SetStateAction<PurchaseRequestItem[]>>
  options: Pick<PurchaseRequestOptions, 'materials'>
  disabled: boolean
  readOnly: boolean
  blocked: boolean
}) {
  const editItem = (
    index: number,
    key: keyof PurchaseRequestItem,
    value: string,
  ) =>
    setItems((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    )
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap justify-between">
        <h2 className="text-base font-semibold">품목</h2>
        {!readOnly && (
          <Button
            type="button"
            variant="secondary"
            disabled={blocked}
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
        <table className="w-full min-w-[1000px] text-xs">
          <thead>
            <tr>
              {['자재', '규격', '단위', '수량', '비고', ''].map((v, i) => (
                <th key={i} className="bg-slate-50 p-2">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!items.length ? (
              <tr>
                <td colSpan={6} className="border p-3 text-center">
                  등록된 품목이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.itemId}>
                  <td className="min-w-52 border p-1">
                    <Select
                      aria-label={`${index + 1}행 자재`}
                      disabled={disabled}
                      value={item.materialId}
                      onChange={(e) => {
                        const m = options.materials.find(
                          (r) => r.materialId === e.target.value,
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
                      aria-label={`${index + 1}행 수량`}
                      value={item.quantity}
                      disabled={disabled}
                      onChange={(e) =>
                        editItem(index, 'quantity', e.target.value)
                      }
                    />
                  </td>

                  <td className="border p-1">
                    <Input
                      aria-label={`${index + 1}행 비고`}
                      value={item.note ?? ''}
                      disabled={disabled}
                      onChange={(e) => editItem(index, 'note', e.target.value)}
                    />
                  </td>
                  <td className="border p-1">
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="danger"
                        disabled={blocked}
                        onClick={() =>
                          setItems((rows) => rows.filter((_, i) => i !== index))
                        }
                      >
                        삭제
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs">필요한 비교 견적은 첨부파일로 등록하십시오.</p>
    </section>
  )
}
