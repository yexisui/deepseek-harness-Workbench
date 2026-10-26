import type {Context} from '@deepseek-ai/cordis'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {InputError} from '../core/validation.ts'

export type EmbeddingProfile={ref:string;model:string;endpoint:string;key:string;fingerprint:string}
export interface Embeddings {choices():Promise<{id:string;name:string;recommended:boolean}[]>;profile(ref:string):Promise<EmbeddingProfile>;embed(profile:EmbeddingProfile,texts:string[],signal:AbortSignal):Promise<number[][]>}
export class WorkbenchEmbeddings implements Embeddings {
 private batchLimits=new Map<string,number>()
 constructor(private ctx:Context){}
 async choices(){const llm=this.ctx.get('llm');if(!llm)return [];const rows:{id:string;name:string;recommended:boolean}[]=[];for(const p of llm.listProviders()){if(!llm.listConfigurableProviders().some(v=>v.provider===p.id))continue;try{for(const m of await llm.listModels(p.id))rows.push({id:p.id+'/'+m.id,name:m.name||m.id,recommended:/embed|bge|e5-/i.test(p.id+' '+m.id)})}catch{}}return rows.sort((a,b)=>Number(b.recommended)-Number(a.recommended))}
 async profile(ref:string):Promise<EmbeddingProfile>{
  const split=ref.indexOf('/'),provider=ref.slice(0,split),model=ref.slice(split+1),llm=this.ctx.get('llm'),settings=this.ctx.get('settings')
  if(split<1||!llm||!settings)throw new InputError('请选择已在模型设置中配置的Embedding模型',409)
  const entry=llm.listConfigurableProviders().find(e=>e.provider===provider)
  if(!entry||!llm.listProviders().some(p=>p.id===provider)||(await llm.listModels(provider)).every(m=>m.id!==model))throw new InputError('所选向量模型已移除或停用，请前往模型设置',409)
  let value:any=settings.get(entry.settingsNs);for(const key of entry.settingsPath)value=value?.[key]
  let url:URL;try{url=new URL(value?.baseURL)}catch{throw new InputError('请在模型设置中填写Embedding API地址',409)}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new InputError('模型接口地址无效',409)
  if(value.api&&!['openai-completions','openai-responses'].includes(value.api))throw new InputError('此提供方尚未适配兼容Embedding协议',409)
  const base=url.href.replace(/\/+$/,''),endpoint=base.endsWith('/embeddings')?base:base+'/embeddings'
  const credentials=this.ctx.get('credentials') as unknown as {resolve(ref:string):Promise<{value:string}|undefined>}
  const saved=await credentials.resolve(value.apiKeyEnv||provider.toUpperCase().replace(/-/g,'_')+'_API_KEY')
  if(value.apiKeyEnv&&!saved)throw new InputError('Embedding API缺少密钥，请前往模型设置',409)
  return {ref,model,endpoint,key:saved?.value||'',fingerprint:createHash('sha256').update(JSON.stringify({ref,model,endpoint,format:'float',mode:'text'})).digest('hex')}
 }
 async embed(profile:EmbeddingProfile,texts:string[],signal:AbortSignal){
  const vectors:number[][]=[]
  for(let start=0;start<texts.length;){
   const input=texts.slice(start,start+(this.batchLimits.get(profile.fingerprint)||16)),batch=await this.batch(profile,input,signal)
   if(vectors[0]&&batch.some(v=>v.length!==vectors[0]!.length))throw new InputError(`Embedding返回的向量维度不一致（预期${vectors[0].length}维），本批未入库`,502)
   vectors.push(...batch);start+=input.length
  }return vectors
 }
 private async batch(profile:EmbeddingProfile,input:string[],signal:AbortSignal):Promise<number[][]>{
   for(let attempt=0;attempt<3;attempt++){
    signal.throwIfAborted()
    try{
     const response=await fetch(profile.endpoint,{method:'POST',redirect:'error',headers:{'content-type':'application/json',...(profile.key?{authorization:'Bearer '+profile.key}:{})},body:JSON.stringify({model:profile.model,input,encoding_format:'float'}),signal:AbortSignal.any([signal,AbortSignal.timeout(60_000)])})
     if(!response.ok){await response.body?.cancel();if((response.status===429||response.status>=500)&&attempt<2){await delay(1000*(attempt+1),undefined,{signal});continue}throw new InputError(response.status===401||response.status===403?'向量模型认证失败，请检查模型设置中的API Key':`向量模型调用失败（HTTP ${response.status}），请检查模型、配额或接口`,502)}
     const raw=await response.text();if(raw.length>16*1024*1024)throw new InputError('向量模型返回内容过大',502)
     const data=JSON.parse(raw).data;if(!Array.isArray(data)||data.length!==input.length)throw new InputError(`Embedding返回的向量数量不正确（请求${input.length}段，返回${Array.isArray(data)?data.length:0}段），本批未入库`,502)
     const indexed=data.every(row=>row&&Number.isInteger(row.index)&&row.index>=0&&row.index<input.length)&&new Set(data.map(row=>row.index)).size===input.length
     if(!indexed){
      // Some gateways restart response indexes for internal micro-batches. Never guess
      // document/vector alignment: retry smaller requests with independently valid indexes.
      if(input.length===1)throw new InputError('Embedding返回的片段编号异常，单段重试后仍无法对应原文，请检查服务返回格式',502)
      this.batchLimits.set(profile.fingerprint,Math.max(1,Math.floor(input.length/2)))
      return await this.embed(profile,input,signal)
     }
     const ordered=data.slice().sort((a,b)=>a.index-b.index)
     const vectors:number[][]=[]
     for(let i=0;i<ordered.length;i++){const v=ordered[i].embedding;if(!Array.isArray(v)||!v.length||v.length>65536||v.some(x=>typeof x!=='number'||!Number.isFinite(x))||!v.some(x=>x!==0))throw new InputError(`Embedding返回第${i+1}段的向量无效（为空、含非数值或全零），本批未入库`,502);if(vectors[0]&&v.length!==vectors[0].length)throw new InputError(`Embedding返回的向量维度不一致（${vectors[0].length}维与${v.length}维），本批未入库`,502);vectors.push(v)}
     return vectors
    }catch(e){if(signal.aborted)throw new InputError('向量化已取消',408);if(e instanceof InputError)throw e;throw new InputError('Embedding API连接失败、超时或响应格式不兼容',502)}
   }
  throw new InputError('Embedding调用重试未完成，请稍后重试',502)
 }
}
