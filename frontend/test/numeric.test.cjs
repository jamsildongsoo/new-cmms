/** 공통 표시 헬퍼는 DB 원본을 바꾸지 않고 큰 숫자도 정확히 반올림한다. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../src/shared/lib/numeric.ts'), 'utf8')
const exported = {}
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported })
const { formatDecimal, validDecimalInput, scaledDecimal } = exported
const reportSource = fs.readFileSync(path.join(__dirname, '../src/modules/inventory/common/report-format.ts'), 'utf8')
const reportExported = {}
vm.runInNewContext(ts.transpileModule(reportSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: reportExported, require: () => exported })
const { formatStockValue } = reportExported
assert.equal(scaledDecimal('12345678901234567890.12', 2), 1234567890123456789012n)
assert.throws(() => scaledDecimal('1.234', 2))
assert.equal(formatDecimal('99999999999999.995', 2), '100000000000000')
assert.equal(formatDecimal('-1.235', 2), '-1.24')
assert.equal(formatDecimal('12.5', 0), '13')
assert.equal(formatDecimal('0.000001', 2), '0')
assert.equal(formatDecimal('1.20', 2), '1.2')
assert.equal(validDecimalInput('1.23', 2), true)
assert.equal(validDecimalInput('1.234', 2), false)
assert.equal(validDecimalInput('12', 0), true)
assert.equal(validDecimalInput('12.3', 0), false)
assert.equal(validDecimalInput('-1.23', 2, true), true)
assert.equal(formatStockValue('averagePrice', '12.5', { quantity: 2, unitPrice: 0 }), '13')
assert.equal(formatStockValue('quantity', '1.234', { quantity: 2, unitPrice: 0 }), '1.23')
console.log('PASS decimal input limits and exact formatting')
