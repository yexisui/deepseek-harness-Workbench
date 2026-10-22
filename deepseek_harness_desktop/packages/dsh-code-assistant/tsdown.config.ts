import { existsSync } from 'node:fs'
import { cp, mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'
export default {
  entry: ['src/index.ts'], platform: 'node', format: 'esm', outDir: 'lib', sourcemap: true, dts: false,
  outExtensions: () => ({ js: '.js' }),
  async onSuccess() {
    const assets = process.env.DSH_CODE_ASSETS
    if (!assets || !existsSync(join(assets, 'engine-runtime/package-lock.json'))) throw new Error('Prepare pinned code-assistant assets before building')
    await mkdir('lib/assets', { recursive: true })
    await cp(join(assets, 'engine-runtime'), 'lib/assets/engine-runtime', { recursive: true })
    await cp(join(assets, 'editor-runtime/node_modules/monaco-editor/min'), 'lib/assets/editor', { recursive: true })
    await copyFile(join(assets, 'editor-runtime/node_modules/monaco-editor/LICENSE'), 'lib/assets/editor/LICENSE.txt')
    await copyFile(join(assets, 'editor-runtime/node_modules/monaco-editor/ThirdPartyNotices.txt'), 'lib/assets/editor/ThirdPartyNotices.txt')
    console.log('Local editor and engine dependencies packaged')
  },
}
