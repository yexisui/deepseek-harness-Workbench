import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {canonical,sha256,packageZip} from './package-archive.ts'
import {id,object,definition} from '../core/validation.ts'
import {catalogFor} from '../core/distribution.ts'
import type {Definition,State} from '../core/model.ts'

export type WorkbenchPackage={protocol:'dsh-workbench-capability-v1';id:string;definition:Definition}
export function exportWorkbench(id:string,value:Definition){
 const {name,description,instructions,components,excludedDependencies,componentOrder}=value
 const data:WorkbenchPackage={protocol:'dsh-workbench-capability-v1',id,definition:{name,description,instructions,components,...(excludedDependencies?{excludedDependencies}:{}),...(componentOrder?{componentOrder}:{})}}
 return{bytes:packageZip(new Map([['workbench-capability.json',Buffer.from(canonical(data))]])),name:exportName(name)}
}
export function exportName(name:string){return name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,80)+'.zip'}
export async function readWorkbench(root:string,state:State):Promise<WorkbenchPackage|undefined>{
 let bytes:Buffer;try{bytes=await readFile(join(root,'workbench-capability.json'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e}
 const data=object(JSON.parse(bytes.toString('utf8')));if(data.protocol!=='dsh-workbench-capability-v1')return
 return {protocol:'dsh-workbench-capability-v1',id:id(data.id),definition:definition(data.definition,catalogFor(state))}
}
export const workbenchHash=(pack:WorkbenchPackage)=>sha256(canonical(pack))
