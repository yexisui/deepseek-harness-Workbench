import {readFile} from 'node:fs/promises'
import {isMap,isSeq,parseDocument} from 'yaml'
import type {WebRoute} from '@deepseek-ai/dsh-host-webserver'
import type {InventoryEntry} from '../core/classification.ts'
import type {ProfileFacts} from './profile.ts'
import type {CliGateway} from './gateway.ts'
import {isLoopbackRequest} from './loopback.ts'
import {readJsonBody,writeJson} from './http.ts'
import {JS_EXPRESSION_TAG,parsePatch,findBareRow,findInsertRow,rowDefaultEnabledOf,writePatchAtomic} from './rows.ts'
import {LOCKED_ENTRY_IDS} from './state.ts'

export interface PresetControl {resolve(id:string):Promise<{path:string;trust:string}>;read(id:string):Promise<string>;compositionInventory?():Promise<{id:string;name?:string;isDefault:boolean;rows:{entryId:string|null;moduleName:string;enabled:boolean|'conditional';fiberState?:number}[]}[]>}
export function lockedReason(entry:InventoryEntry){
 if(entry.controlReason)return entry.controlReason
 if(LOCKED_ENTRY_IDS.has(entry.entryId.replace(/^include:/,''))||/(?:^|\/)(?:dsh-host-|dsh-client-connection|dsh-client-ui-renderer|dsh-client-ui-settings|dsh-client-ui-plugin-manager|dsh-client-ui-skill-explorer|dsh-connection|dsh-scope|cordis-plugin-loader|dsh-agent-presets|dsh-settings|dsh-sessions|dsh-agents|dsh-web-all$|dsh-web-ui-compat$)/.test(entry.moduleName))return '工作台基础或管理服务，不能在此关闭'
 if(entry.entryId.replace(/^include:/,'').includes(':'))return '嵌套服务由所属插件管理，不能单独覆盖'
 if(entry.fiberPhase==='conditional')return '此条目由条件表达式控制，请在对应服务配置中调整'
 return undefined
}
export async function configuredInventory(facts:ProfileFacts,entries:InventoryEntry[]){
 const overrides=rowDefaultEnabledOf(await readFile(facts.patchPath,'utf8'))
 return entries.map(e=>{const desired=overrides.get(e.entryId.replace(/^include:/,''))??e.enabled;return {...e,enabled:desired,runtimeEnabled:e.enabled,pendingRestart:desired!==e.enabled,controlReason:lockedReason(e)}})
}
export function exactOverride(text:string,id:string,moduleName:string,enabled:boolean){const {document,root}=parsePatch(text,'profile');const target=id.replace(/^include:/,'');const row=findInsertRow(root,target)??findBareRow(root,target)?.row;if(row){if(row.has('name')&&row.get('name')!==moduleName)throw Error('插件条目身份已改变');const gate=row.get('disabled',true);if(gate&&typeof gate==='object'&&'tag' in gate&&gate.tag===JS_EXPRESSION_TAG.tag)throw Error('此条目由条件表达式控制');row.set('disabled',!enabled)}else root.items.push(document.createNode({id:target,name:moduleName,disabled:!enabled}));return document.toString()}
export function editPreset(text:string,id:string,moduleName:string,enabled:boolean){
 const doc=parseDocument(text,{customTags:[JS_EXPRESSION_TAG],uniqueKeys:true});if(doc.errors.length||!isSeq(doc.contents))throw Error('预设配置不可编辑')
 const found:any[]=[];const visit=(rows:any)=>{if(!isSeq(rows))return;for(const row of rows.items){if(!isMap(row))continue;if(row.get('id')===id&&row.get('name')===moduleName)found.push(row);if(row.get('group')===true)visit(row.get('config',true))}};visit(doc.contents)
 if(found.length!==1)throw Error('该条目没有唯一稳定 ID，不能单独切换')
 const disabled=found[0].get('disabled',true);if(disabled&&disabled.tag===JS_EXPRESSION_TAG.tag)throw Error('不能覆盖条件启停表达式')
 found[0].set('disabled',!enabled);return doc.toString()
}
export function presetConfiguredRows(text:string,rows:InventoryEntry[],trust:string,presetId?:string){
 const doc=parseDocument(text,{customTags:[JS_EXPRESSION_TAG],uniqueKeys:true});const found=new Map<string,any>();const visit=(seq:any)=>{if(!isSeq(seq))return;for(const row of seq.items){if(!isMap(row))continue;if(typeof row.get('id')==='string')found.set(String(row.get('id')),row);if(row.get('group')===true)visit(row.get('config',true))}};visit(doc.contents)
 return rows.map(row=>{const raw=found.get(row.entryId),disabled=raw?.get('disabled'),reason=presetId?.startsWith('workbench-')?'此预设由岗位管理维护，请到能力中心或岗位配置中调整':trust!=='user'?'内置预设只读，请在预设管理中复制为本地预设':!raw?'该条目没有可编辑的稳定 ID':disabled!==undefined&&typeof disabled!=='boolean'?'由条件表达式控制':undefined;return {...row,enabled:raw&&!reason?disabled!==true:row.enabled,controlReason:reason}})
}
export function inventoryControlRoute(facts:ProfileFacts,gateway:CliGateway,inventory:()=>InventoryEntry[],presets:()=>PresetControl|undefined,beforeChange:(name:string)=>Promise<void>):WebRoute {
 return {kind:'exact',path:'/api/plugin-manager/inventory-control',handler:async(req,res)=>{
  if(!isLoopbackRequest(req)){writeJson(res,403,{error:'loopback-only'});return}
  if(req.method==='GET'){try{const service=presets();const agentPresets=service?.compositionInventory?await Promise.all((await service.compositionInventory()).map(async p=>{const rows=p.rows.map((e,i)=>({entryId:e.entryId??'row-'+i,moduleName:e.moduleName,enabled:e.enabled===true,fiberPhase:e.enabled==='conditional'?'conditional':e.fiberState===undefined?null:['pending','loading','active','failed',null,'unloading'][e.fiberState]??null}));try{return {...p,rows:presetConfiguredRows(await service.read(p.id),rows,(await service.resolve(p.id)).trust,p.id)}}catch{return {...p,rows:rows.map(r=>({...r,controlReason:'无法读取预设配置'}))}}})):undefined;writeJson(res,200,{entries:await configuredInventory(facts,inventory()),agentPresets})}catch(e){writeJson(res,400,{error:String(e)})}return}
  if(req.method!=='POST'){writeJson(res,405,{error:'method-not-allowed'});return}
  try{const b=await readJsonBody(req,{maxBytes:64*1024,objectOnly:true}) as Record<string,unknown>;if(!b||typeof b.id!=='string'||typeof b.moduleName!=='string'||typeof b.enabled!=='boolean'||typeof b.expected!=='boolean'||typeof b.scope!=='string')throw Error('无效的插件开关请求')
   const result=await gateway.withMutationLock(async()=>{
    const {id,moduleName,enabled,expected,scope}=b as {id:string;moduleName:string;enabled:boolean;expected:boolean;scope:string}
    if(scope!=='global'){
     const service=presets();if(!service)throw Error('会话预设服务未就绪');const preset=await service.resolve(scope);if(preset.trust!=='user')throw Error('内置预设只读，请先在岗位/预设管理中复制为本地预设')
     const text=await service.read(scope),current=presetConfiguredRows(text,[{entryId:id,moduleName,enabled:expected,fiberPhase:null}],preset.trust,scope)[0];if(current.controlReason)throw Error(current.controlReason);if(current.enabled!==expected)throw Error('预设状态已改变，请刷新后重试');const next=editPreset(text,id,moduleName,enabled)
     if(!enabled)await beforeChange(moduleName)
     if(await readFile(preset.path,'utf8')!==text)throw Error('预设已经改变，请刷新后重试')
     await writePatchAtomic(preset.path,next);return {enabled,notice:'已保存，仅后续新会话使用；现有会话保持原组合。'}
    }
    const entry=(await configuredInventory(facts,inventory())).find(e=>e.entryId===id&&e.moduleName===moduleName);if(!entry)throw Error('条目不存在，请刷新');if(entry.controlReason)throw Error(entry.controlReason);if(entry.enabled!==expected)throw Error('开关状态已改变，请刷新后重试')
    if(!enabled)await beforeChange(entry.sourceModule??moduleName)
    const text=await readFile(facts.patchPath,'utf8'),next=exactOverride(text,id,moduleName,enabled)
    await writePatchAtomic(facts.patchPath,next)
    let current=inventory().find(e=>e.entryId===id&&e.moduleName===moduleName)
    for(let attempt=0;attempt<24&&current?.enabled!==enabled;attempt++){await new Promise(resolve=>setTimeout(resolve,50));current=inventory().find(e=>e.entryId===id&&e.moduleName===moduleName)}
    const pendingRestart=current?.enabled!==enabled
    return {enabled,notice:pendingRestart?'启用设置已保存，运行时尚未应用；正常重启后生效。':'启用设置已应用；运行情况以卡片状态为准。',pendingRestart}
   });writeJson(res,200,result)
  }catch(e){writeJson(res,400,{error:e instanceof Error?e.message:String(e)})}
 }}
}
