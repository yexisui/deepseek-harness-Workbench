import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { config, defaults, JevError, type SavedConfig, type JevTrace, type JevDiagnostic } from '../core/contract.ts'
export class JevStore {
  private saved: SavedConfig = {schema:1,revision:0,value:{...defaults}}
  private previousRoutingConfig?: string
  private tail: Promise<unknown> = Promise.resolve()
  private traces: JevTrace[] = []
  private validations: {key: string; result: JevDiagnostic}[] = []
  constructor(readonly root: string) {}
  private async atomic(name: string,value: unknown) {
    const file=join(this.root,name),temp=file+'.'+randomUUID()+'.tmp',handle=await open(temp,'wx')
    try {await handle.writeFile(JSON.stringify(value));await handle.sync()}finally{await handle.close()}
    try {await rename(temp,file)}catch(error){await unlink(temp).catch(()=>{});throw error}
  }
  async init() {
    await mkdir(this.root,{recursive:true})
    try {const original=await readFile(join(this.root,'config.json'),'utf8'),d=JSON.parse(original);if(![1,2].includes(d.schema)||!Number.isSafeInteger(d.revision)||d.revision<0)throw new Error();this.saved={schema:d.schema,revision:d.revision,value:config(d.value)};if(d.value.connectionMode!=='account'){this.previousRoutingConfig=original}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new JevError('JEV 配置无法读取；请保留文件并检查，不能自动覆盖')}
    try {const d=JSON.parse(await readFile(join(this.root,'traces.json'),'utf8'));if(!Array.isArray(d))throw new Error();this.traces=d.slice(-200)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new JevError('JEV 轨迹无法读取；请保留文件并检查')}
    try {const d=JSON.parse(await readFile(join(this.root,'validations.json'),'utf8'));if(!Array.isArray(d)||d.some(v=>typeof v.key!=='string'||!['passed','failed','cancelled'].includes(v.result?.status)))throw new Error();this.validations=d.slice(-20)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new JevError('JEV 检查记录无法读取；请保留文件并检查')}
  }
  snapshot() {return structuredClone(this.saved)}
  history(scope?: string) {return structuredClone(this.traces.filter(t=>!scope||t.scope===scope).slice(-200))}
  validation(key: string) {return structuredClone(this.validations.find(v=>v.key===key)?.result)}
  validate(key: string,result: JevDiagnostic) {return this.serial(async()=>{const next=[...this.validations.filter(v=>v.key!==key),{key,result}].slice(-20);await this.atomic('validations.json',next);this.validations=next})}
  private serial<T>(fn:()=>Promise<T>):Promise<T>{const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p}
  update(revision: number,value: unknown,guard?:(value:ReturnType<typeof config>)=>void) {return this.serial(async()=>{
    if(revision!==this.saved.revision)throw new JevError('JEV 设置已改变，请保留草稿并核对最新配置')
    const parsed=config(value);guard?.(parsed)
    const schema=parsed.candidates===undefined?this.saved.schema:2
    // Keep the last single-model configuration for an explicit rollback. Old hosts reject
    // schema 2 instead of silently ignoring candidate switches and calling a stale model.
    if(schema===2&&this.saved.schema===1){
      let backup;try{backup=await open(join(this.root,'config.before-candidates.json'),'wx')}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}
      if(backup)try{await backup.writeFile(JSON.stringify(this.saved));await backup.sync()}finally{await backup.close()}
    }
    // Keep the exact legacy configuration before the first normalized save.
    if(this.previousRoutingConfig!==undefined){
      let backup;try{backup=await open(join(this.root,'config.before-model-routing.json'),'wx')}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e}
      if(backup)try{await backup.writeFile(this.previousRoutingConfig);await backup.sync()}finally{await backup.close()}
    }
    const next:SavedConfig={schema,revision:revision+1,value:parsed};await this.atomic('config.json',next);this.saved=next;this.previousRoutingConfig=undefined;return this.snapshot()
  })}
  record(trace: JevTrace) {return this.serial(async()=>{const next=[...this.traces,trace].slice(-200);await this.atomic('traces.json',next);this.traces=next})}
  close() {return this.tail}
}
