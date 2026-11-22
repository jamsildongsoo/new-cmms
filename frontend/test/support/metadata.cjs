/** 메타데이터 응답은 백엔드 원본에서 만든다. 빌드 결과나 복사된 JSON에 의존하지 않는다. */
const fs = require('node:fs')
const path = require('node:path')
const backendRoot = path.resolve(__dirname, '../../../backend')
const ts = require(path.join(backendRoot, 'node_modules/typescript'))
const original = require.extensions['.ts']
try {
  require.extensions['.ts'] = (module, filename) => {
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    })
    module._compile(compiled.outputText, filename)
  }
  const { MetadataController } = require(
    path.join(backendRoot, 'src/system/metadata.controller.ts'),
  )
  module.exports = new MetadataController().metadata()
} finally {
  if (original) require.extensions['.ts'] = original
  else delete require.extensions['.ts']
}
