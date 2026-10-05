import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { relatedComponents, modulePackage } from '../../../dsh-capabilities/src/core/component-registry.ts'
import type { AiClassificationAdapter, PluginEvidence } from './ai-classification.ts'

interface Llm {
  listProviders():Array<{id:string;name:string}>
  listModels(provider:string):Promise<Array<{id:string;name:string;inputModalities?:readonly string[]}>>
  stream(options:unknown):AsyncIterable<{type:string;text?:string;reason?:{kind:string}}>
}
export function workbenchClassificationAdapter(ctx:Context,profileDir:string):AiClassificationAdapter{
  const require=createRequire(path.join(profileDir,'package.json'))
  const llm=()=>{const service=ctx.get('llm' as never) as unknown as Llm|undefined;if(!service)throw Error('模型服务尚未就绪，请在模型设置中检查已有账号');return service}
  return {
    async firstModel(signal){
      const service=llm()
      // Same registered provider/model ordering as the workbench model catalog.
      for(const provider of service.listProviders()){
        signal.throwIfAborted()
        let models;try{models=await service.listModels(provider.id)}catch{continue}
        signal.throwIfAborted()
        const model=models.find(m=>m.id&&(!m.inputModalities||m.inputModalities.includes('text')))
        if(model)return {provider:provider.id,id:model.id,name:provider.name+' / '+model.name}
      }
      throw Error('没有已配置的文本模型，请先到模型设置中配置')
    },
    evidence(entry){
      const result:PluginEvidence={}
      const packageId=modulePackage(entry.moduleName)
      if(/^(@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/.test(packageId)&&!packageId.startsWith('.')){
        try{
          let file:string
          try{file=require.resolve(packageId+'/package.json')}catch{
            let dir=path.dirname(require.resolve(entry.moduleName));file=''
            for(let i=0;i<8;i++){const candidate=path.join(dir,'package.json');try{if(statSync(candidate).size<=65536&&JSON.parse(readFileSync(candidate,'utf8')).name===packageId){file=candidate;break}}catch{};const parent=path.dirname(dir);if(parent===dir)break;dir=parent}
          }
          if(file&&statSync(file).size<=65536){const p=JSON.parse(readFileSync(file,'utf8'));result.description=typeof p.description==='string'?p.description.slice(0,1800):undefined;result.keywords=Array.isArray(p.keywords)?p.keywords.filter((s:unknown)=>typeof s==='string').slice(0,12).map((s:string)=>s.slice(0,80)):[];result.exports=p.exports&&typeof p.exports==='object'?Object.keys(p.exports).slice(0,20).map(s=>s.slice(0,100)):[]}
        }catch{/* Missing metadata is not fabricated and must not execute the plugin. */}
      }
      result.components=relatedComponents(entry.moduleName).slice(0,8).map(c=>({name:c.name,description:c.sourceLabel,actions:c.actions.slice(0,12)}))
      return result
    },
    async generate(model,system,prompt,signal){
      let text=''
      for await(const chunk of llm().stream({provider:model.provider,model:model.id,system,messages:[{id:randomUUID(),role:'user',content:[{type:'text',text:prompt}],source:{kind:'user'}}],maxTokens:4096,temperature:0.1,signal})){
        signal.throwIfAborted()
        if(chunk.type==='text-delta')text+=chunk.text??''
        if(text.length>40_000)throw Error('模型返回过长')
        if(chunk.type==='finish'&&chunk.reason?.kind==='error')throw Error('模型调用失败，请检查已有账号配置')
      }
      return text
    },
  }
}
