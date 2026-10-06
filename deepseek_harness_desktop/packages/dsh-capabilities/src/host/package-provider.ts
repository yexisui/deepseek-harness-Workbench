import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import type { CapabilityManifest } from '../core/distribution.ts'

/** Activation runs only after the user trusts the package. It never calls an ability action. */
export function loadPackageProvider(directory:string,manifest:CapabilityManifest):Promise<void>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');try{for(const entry of workerData){const mod=require(entry);if(typeof mod.execute!=='function')throw new Error('组件未导出 execute 方法')}parentPort.postMessage({ready:true})}catch(e){parentPort.postMessage({error:String(e.message||e)})}`,{eval:true,workerData:manifest.components.map(c=>join(directory,c.entry)),env:{},stdout:true,stderr:true,resourceLimits:{maxOldGenerationSizeMb:128,stackSizeMb:4}})
    let settled=false,bytes=0
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate().then(()=>error?reject(error):resolve(),reject)}
    const timer=setTimeout(()=>finish(new Error('执行组件加载超过 5 秒，未启用能力')),5000)
    const drain=(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>256000)finish(new Error('组件初始化输出过多，未启用能力'))}
    worker.stdout?.on('data',drain);worker.stderr?.on('data',drain)
    worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(new Error(`执行组件加载中断（${code}）`))})
    worker.on('message',message=>finish(message?.ready===true?undefined:new Error(String(message?.error??'执行组件加载失败').slice(0,2000))))
  })
}
