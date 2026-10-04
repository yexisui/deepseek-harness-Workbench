import { useEffect, useState, useSyncExternalStore } from 'react'
import { config, type JevConfig, type JevStatus, type JevDiagnostic } from '../core/contract.ts'
type View={data:JevStatus|null;error:string;readError:string;saveError:string;checkError:string;busy:boolean;checkBusy:boolean}
export function createJevClient(request:typeof fetch=(...args)=>fetch(...args)){
  let view:View={data:null,error:'',readError:'',saveError:'',checkError:'',busy:false,checkBusy:false},sequence=0,pending:Promise<void>|undefined
  const listeners=new Set<()=>void>()
  const emit=(patch:Partial<View>)=>{view={...view,...patch};view.error=view.saveError||view.readError;listeners.forEach(f=>f())}
  async function api<T>(path:string,body?:unknown):Promise<T>{const response=await request('/api/jev-mode/'+path,{credentials:'same-origin',signal:AbortSignal.timeout(path==='check'?130000:15000),...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});const data=await response.json().catch(()=>({error:'JEV 服务尚未加载，请在正常重启工作台后重试'}));if(!response.ok)throw new Error(data.error??'JEV 请求失败');return data}
  const state=(data:JevStatus)=>{try{config(data.config.value);if(!Number.isSafeInteger(data.config.revision)||!Array.isArray(data.traces)||!['off','ready','unavailable'].includes(data.state))throw Error();return data}catch{throw new Error('JEV 服务响应无效，请在正常重启工作台后重新加载')}}
  return {
    getSnapshot:()=>view,
    subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn)}},
    api,
    refresh(){if(pending)return pending;if(view.busy)return Promise.resolve();const requestId=++sequence;pending=api<JevStatus>('state').then(state).then(data=>{if(requestId===sequence)emit({data,readError:''})}).catch(e=>{if(requestId===sequence)emit({readError:String(e.message??e)})}).finally(()=>{pending=undefined});return pending},
    clearSaveError(){emit({saveError:''})},
    async save(value:JevConfig,revision=view.data?.config.revision){if(revision===undefined||view.busy)throw new Error('JEV 配置尚未就绪');++sequence;emit({busy:true,saveError:''});try{const data=state(await api<JevStatus>('config',{revision,value}));emit({data});return data}catch(e){emit({saveError:(e as Error).message});throw e}finally{emit({busy:false})}},
    async check(value:JevConfig){emit({checkBusy:true,checkError:''});try{const diagnostic=await api<JevDiagnostic>('check',{value});if(view.data)emit({data:{...view.data,diagnostic}});return diagnostic}catch(e){emit({checkError:(e as Error).message});throw e}finally{emit({checkBusy:false})}},
    async cancel(id:string){emit({checkBusy:true,checkError:''});try{const diagnostic=await api<JevDiagnostic>('check/cancel',{id});if(view.data)emit({data:{...view.data,diagnostic}})}catch(e){emit({checkError:(e as Error).message});throw e}finally{emit({checkBusy:false})}},
  }
}
export const jevClient=createJevClient()
let watchers=0,stop:undefined|(()=>void)
export function useJev(){const view=useSyncExternalStore(jevClient.subscribe,jevClient.getSnapshot);useEffect(()=>{if(watchers++===0){void jevClient.refresh();const refresh=()=>{if(!document.hidden)void jevClient.refresh()},timer=window.setInterval(refresh,1500);window.addEventListener('focus',refresh);stop=()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}}return()=>{if(--watchers===0)stop?.()}},[]);return view}
export function useJevScope(scope?:string){
  const [view,setView]=useState<{scope?:string;data?:JevStatus;error?:string}>({})
  useEffect(()=>{if(!scope)return;let live=true,running=false;const read=async()=>{if(running||document.hidden)return;running=true;try{const data=await jevClient.api<JevStatus>('state?scope='+encodeURIComponent(scope));if(!data.config||!Array.isArray(data.traces))throw new Error('JEV 会话状态响应无效');if(live)setView({scope,data})}catch(e){if(live)setView(old=>({...old,scope,error:(e as Error).message}))}finally{running=false}};void read();const timer=setInterval(()=>void read(),1500);return()=>{live=false;clearInterval(timer)}},[scope])
  return view.scope===scope?view:{}
}

