const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('../node_modules/typescript')
const source = fs.readFileSync(path.join(__dirname, '../src/shared/lib/format.ts'), 'utf8')
const exported = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported })
const { dateInput, dateValue, monthInput, todayDateInput, formatDateTime } = exported
for (const value of [null, undefined, '']) {
  assert.equal(dateInput(value), '')
  assert.equal(dateValue(value), '')
}
for (const value of ['20240229', '20261118', '00990101']) {
  assert.equal(dateValue(dateInput(value)), value)
}
assert.equal(dateInput('2026-11-18'), '2026-11-18')
assert.equal(monthInput('202611'), '2026-11')
assert.equal(dateValue(monthInput('202611')), '202611')
assert.equal(monthInput(null), '')
assert.equal(todayDateInput(new Date('2026-11-17T15:00:00Z')), '2026-11-18')
assert.equal(todayDateInput(new Date('2026-11-17T14:59:59Z')), '2026-11-17')
assert.equal(formatDateTime('2026-11-17T15:00:00Z'), '2026-11-18 00:00:00')
assert.equal(formatDateTime('invalid'), '-')
console.log('PASS shared date conversion and Seoul date boundaries')
