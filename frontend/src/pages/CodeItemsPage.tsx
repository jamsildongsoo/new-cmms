import { useCallback, useEffect, useState } from 'react'
import {
  createCodeItem,
  deleteCodeItem,
  getCodeCategories,
  getCodeItems,
  updateCodeItem,
  type CodeCategory,
  type CodeItem,
  type CodeItemPayload,
} from '../api/codes.api'
import { Field } from '../components/ui/Field'
import { Select } from '../components/ui/Select'
import { MasterPage } from './MasterPage'

export function CodeItemsPage() {
  const [categories, setCategories] = useState<CodeCategory[]>([])
  const [codeId, setCodeId] = useState('')

  useEffect(() => {
    let active = true
    getCodeCategories()
      .then((data) => {
        if (active) {
          setCategories(data)
          setCodeId((current) => current || data[0]?.codeId || '')
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const loadRows = useCallback(
    () => (codeId ? getCodeItems(codeId) : Promise.resolve([])),
    [codeId],
  )

  return (
    <div className="space-y-3">
      <Field label="Code Category" className="max-w-sm">
        <Select value={codeId} onChange={(event) => setCodeId(event.target.value)}>
          {categories.map((category) => (
            <option key={category.codeId} value={category.codeId}>
              {category.codeId} - {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <MasterPage<CodeItem, CodeItemPayload>
        key={codeId}
        title="Code Items"
        subtitle="Items of the selected code category"
        permissionPrefix="code"
        idLabel="code item"
        getId={(row) => row.codeItemId}
        emptyForm={{ codeItemId: '', name: '', sortOrder: '' }}
        fields={[
          {
            key: 'codeItemId',
            label: 'Item ID',
            required: true,
            disabledOnEdit: true,
          },
          { key: 'name', label: 'Name', required: true },
          { key: 'sortOrder', label: 'Sort Order' },
        ]}
        columns={[
          { key: 'codeItemId', label: 'Item ID', render: (row) => row.codeItemId },
          { key: 'name', label: 'Name', render: (row) => row.name },
          {
            key: 'sortOrder',
            label: 'Sort Order',
            render: (row) => String(row.sortOrder),
          },
        ]}
        toForm={(row) => ({
          codeItemId: row.codeItemId,
          name: row.name,
          sortOrder: row.sortOrder,
        })}
        loadRows={loadRows}
        createRow={(payload) => createCodeItem(codeId, payload)}
        updateRow={(id, payload) => updateCodeItem(codeId, id, payload)}
        deleteRow={(id) => deleteCodeItem(codeId, id)}
      />
    </div>
  )
}
