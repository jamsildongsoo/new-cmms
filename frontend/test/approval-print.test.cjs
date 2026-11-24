const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')

const source = fs.readFileSync(
  path.join(__dirname, '../src/modules/approvals/approvalPrint.ts'),
  'utf8',
)
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exported = {}
let printed
const groups = {
  source: [{ originalName: '원문<계획서>.pdf' }],
  own: [{ originalName: '결재 의견.txt' }],
}
vm.runInNewContext(code, {
  exports: exported,
  require: (name) => {
    if (name === '@/modules/attachments')
      return { getAttachmentItems: async (id) => groups[id] }
    if (name === '@/shared/lib/print')
      return { printDocument: (options) => { printed = options } }
    if (name === './approvalForm')
      return { formatDate: (value) => value || '-', stepStatus: () => '승인' }
    throw new Error(`Unexpected import: ${name}`)
  },
})

async function main() {
  await exported.printApprovalDetail({
    title: '설비 구매 결재',
    approvalId: 'APPROV-202611-00001',
    documentNo: '관리-25',
    contentJson: { type: 'doc', content: [] },
    sourceAttachmentIds: ['source'],
    attachmentId: 'own',
    steps: [{
      stepNo: 1, type: 'APPROVER', userName: '김결재',
      deptName: '설비팀', position: '과장', title: '팀장',
      status: 'Y', actedAt: '2026-11-23 10:00', comment: '확인<완료>',
    }],
  }, { APPROVER: '결재' })
  assert.equal(printed.title, '설비 구매 결재')
  assert.equal(printed.landscape, true)
  assert.deepEqual(Array.from(printed.fields, (row) => Array.from(row)), [
    ['문서번호', 'APPROV-202611-00001'],
    ['관리번호', '관리-25'],
  ])
  for (const label of ['이름', '부서', '직급', '직책', '유형', '상태', '일시', '의견'])
    assert.ok(printed.htmlBeforeContent.includes(`<th>${label}</th>`))
  assert.ok(printed.htmlBeforeContent.includes('확인&lt;완료&gt;'))
  assert.ok(printed.htmlAfterContent.includes('원문&lt;계획서&gt;.pdf'))
  assert.ok(
    printed.htmlAfterContent.indexOf('원문&lt;계획서&gt;.pdf') <
      printed.htmlAfterContent.indexOf('결재 의견.txt'),
  )
  console.log('PASS approval print includes numbered metadata, line details, and attachments')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
