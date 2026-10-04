import { useEffect, useSyncExternalStore } from 'react'
import { config, type JevConfig, type JevStatus } from '../core/contract.ts'
type View={data:JevStatus|null;error:string;busy:boolean}
export function createJevClient(request:typeof fetch=(...args)=>fetch(...args)){
  let view:View={data:null,error:'',busy:false},sequence=0,pending:Promise<void>|undefined
  const listeners=new Set<()=>void>()
  const emit=(patch:Partial<View>)=>{view={...view,...patch};listeners.forEach(f=>f())}
  async function api<T>(path:string,body?:unknown):Promise<T>{const response=await request('/api/jev-mode/'+path,{credentials:'same-origin',signal:AbortSignal.timeout(path==='check'?130000:15000),...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});const data=await response.json().catch(()=>({error:'JEV 服务尚未加载，请在正常重启工作台后重试'}));if(!response.ok)throw new Error(data.error??'JEV 请求失败');return data}
  const state=(data:JevStatus)=>{try{config(data.config.value);if(!Number.isSafeInteger(data.config.revision)||!Array.isArray(data.traces)||!['off','ready','unavailable'].includes(data.state))throw Error();return data}catch{throw new Error('JEV 服务响应无效，请在正常重启工作台后重新加载')}}
  return {
    getSnapshot:()=>view,
    subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},
    api,
    refresh(){if(pending)return pending;if(view.busy)return Promise.resolve();const requestId=++sequence;pending=api<JevStatus>('state').then(state).then(data=>{if(requestId===sequence)emit({data,error:''})}).catch(e=>{if(requestId===sequence)emit({error:String(e.message??e)})}).finally(()=>{pending=undefined});return pending},
    async save(value:JevConfig,revision=view.data?.config.revision){if(revision===undefined||view.busy)throw new Error('JEV 配置尚未就绪');++sequence;emit({busy:true,error:''});try{const data=state(await api<JevStatus>('config',{revision,value}));emit({data});return data}catch(e){emit({error:(e as Error).message});throw e}finally{emit({busy:false})}},
  }
}
export const jevClient=createJevClient()
export function useJev(){const view=useSyncExternalStore(jevClient.subscribe,jevClient.getSnapshot);useEffect(()=>{void jevClient.refresh();const refresh=()=>{if(!document.hidden)void jevClient.refresh()},timer=window.setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);return view}
