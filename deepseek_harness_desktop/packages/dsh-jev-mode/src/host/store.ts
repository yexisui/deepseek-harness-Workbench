import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { config, defaults, JevError, type SavedConfig, type JevTrace } from '../core/contract.ts'
export class JevStore {
  private saved: SavedConfig = {schema:1,revision:0,value:{...defaults}}
  private tail: Promise<unknown> = Promise.resolve()
  private traces: JevTrace[] = []
  constructor(readonly root: string) {}
  private async atomic(name: string,value: unknown) {
    const file=join(this.root,name),temp=file+'.'+randomUUID()+'.tmp',handle=await open(temp,'wx')
    try {await handle.writeFile(JSON.stringify(value));await handle.sync()}finally{await handle.close()}
    try {await rename(temp,file)}catch(error){await unlink(temp).catch(()=>{});throw error}
  }
  async init() {
    await mkdir(this.root,{recursive:true})
    try {const d=JSON.parse(await readFile(join(this.root,'config.json'),'utf8'));if(d.schema!==1||!Number.isSafeInteger(d.revision)||d.revision<0)throw new Error();this.saved={schema:1,revision:d.revision,value:config(d.value)}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new JevError('JEV 配置无法读取；请保留文件并检查，不能自动覆盖')}
    try {const d=JSON.parse(await readFile(join(this.root,'traces.json'),'utf8'));if(!Array.isArray(d))throw new Error();this.traces=d.slice(-200)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new JevError('JEV 轨迹无法读取；请保留文件并检查')}
  }
  snapshot() {return structuredClone(this.saved)}
  history(scope?: string) {return structuredClone(this.traces.filter(t=>!scope||t.scope===scope).slice(-60))}
  private serial<T>(fn:()=>Promise<T>):Promise<T>{const p=this.tail.then(fn);this.tail=p.catch(()=>{});return p}
  update(revision: number,value: unknown) {return this.serial(async()=>{if(revision!==this.saved.revision)throw new JevError('JEV 设置已改变，请刷新后重试');const next:SavedConfig={schema:1,revision:revision+1,value:config(value)};await this.atomic('config.json',next);this.saved=next;return this.snapshot()})}
  record(trace: JevTrace) {return this.serial(async()=>{const next=[...this.traces,trace].slice(-200);await this.atomic('traces.json',next);this.traces=next})}
  close() {return this.tail}
}
