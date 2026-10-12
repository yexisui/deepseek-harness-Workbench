import { execFileSync } from 'node:child_process'
import { clientBundle } from '../../shared/tsdown.client.ts'
export default clientBundle('@linxin666/dsh-capabilities', ['src/index.ts', 'src/policy.ts', 'src/browser.ts'], {lib:{onSuccess:()=>{execFileSync(process.execPath,['editor/build.mjs'],{stdio:'inherit'})}}})
