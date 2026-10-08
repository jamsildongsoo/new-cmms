import {
  createCodeCategory,
  deleteCodeCategory,
  getCodeCategories,
  updateCodeCategory,
  type CodeCategory,
  type CodeCategoryPayload,
} from '../api/codes.api'
import { MasterPage } from './MasterPage'

export function CodeCategoriesPage() {
  return (
    <MasterPage<CodeCategory, CodeCategoryPayload>
      title="Code Categories"
      subtitle="Code categories by module"
      permissionPrefix="code"
      idLabel="code category"
      getId={(row) => row.codeId}
      emptyForm={{ codeId: '', name: '', module: '' }}
      fields={[
        { key: 'codeId', label: 'Code ID', required: true, disabledOnEdit: true },
        { key: 'name', label: 'Name', required: true },
        { key: 'module', label: 'Module', required: true },
      ]}
      columns={[
        { key: 'codeId', label: 'Code ID', render: (row) => row.codeId },
        { key: 'name', label: 'Name', render: (row) => row.name },
        { key: 'module', label: 'Module', render: (row) => row.module },
      ]}
      toForm={(row) => ({
        codeId: row.codeId,
        name: row.name,
        module: row.module,
      })}
      loadRows={getCodeCategories}
      createRow={createCodeCategory}
      updateRow={updateCodeCategory}
      deleteRow={deleteCodeCategory}
    />
  )
}
