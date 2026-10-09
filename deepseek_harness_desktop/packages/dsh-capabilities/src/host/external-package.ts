import { readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { listPlainFiles } from '../../../dsh-market/src/core/local-import-safety.ts'
import { canonical, safeLocalPath, sha256, type CheckedPackage } from './package-archive.ts'
import type { CapabilityManifest } from '../core/distribution.ts'
import { importSystem } from './import-template.ts'

export type ImportModel = (prompt:string,system:string,signal:AbortSignal)=>Promise<string>
const privateFile = /(^|\/)(\.env(?:\..*)?|.*credentials.*|ai_key\.txt|settings\.ya?ml|state\.json|id_rsa|id_ed25519)$/i
const ignored = /(^|\/)(\.git|\.svn|\.pnpm|node_modules\/\.cache)(\/|$)/i
function parse(text:string):Record<string,any>{const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw new Error('AI未完成整理，已保留原包，请重试');return JSON.parse(text.slice(start,end+1))}
function slug(value:unknown,fallback:string){const result=String(value??'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);return /^[a-z]/.test(result)?result:fallback}

/** Local sources are inert during preparation. Only an explicitly installed action can execute them. */
export async function adaptExternal(root:string,label:string,useAI:boolean,model:ImportModel|undefined,signal:AbortSignal,progress:(text:string)=>void):Promise<CheckedPackage>{
  const files=new Map<string,Buffer>()
  for(const item of listPlainFiles(root))if(!privateFile.test(item.rel)&&!ignored.test(item.rel))files.set(item.rel,await readFile(join(root,item.rel)))
  if(!files.size)throw new Error('包中没有可处理的文件，请补充文件后重试')
  const skill=[...files.keys()].find(p=>/(^|\/)SKILL\.md$/i.test(p))
  let pkg:Record<string,any>={};try{pkg=JSON.parse(files.get('package.json')?.toString()??'{}')}catch{}
  const title=String(pkg.name??label.replace(/\.zip$/i,'')??basename(root))
  // Stable identity survives source updates; model wording never decides whether to create duplicates.
  const identity=String(pkg.name??(skill?files.get(skill)!.toString().match(/^name:\s*(.+)$/m)?.[1]:undefined)??title)
  let result:Record<string,any>
  if(useAI){
    if(!model)throw new Error('默认模型服务暂不可用，原包已保留，请稍后重试')
    progress('正在使用默认模型整理并适配…')
    const inventory=[...files].map(([p,b])=>({path:p,bytes:b.length}))
    const initial=[...files].filter(([p])=>/(^|\/)(SKILL\.md|README(?:\.[a-z]+)?\.md|package\.json)$/i.test(p)||/\.(c?js|mjs|ts|py|sh|ps1)$/.test(p)&&!p.includes('/tests/')&&!p.endsWith('.d.ts')).sort(([a],[b])=>Number(!/(SKILL|README|package\.json)/i.test(a))-Number(!/(SKILL|README|package\.json)/i.test(b)))
    let budget=100000;const contents:Record<string,string>={}
    for(const [p,b] of initial){if(b.length<=budget&&!b.includes(0)){contents[p]=b.toString('utf8');budget-=b.length}}
    let prompt=JSON.stringify({filename:label,inventory,contents})
    for(let turn=0;;turn++){
      signal.throwIfAborted();result=parse(await model(prompt,importSystem,signal));signal.throwIfAborted()
      if(!Array.isArray(result.read))break
      if(turn>=15)throw new Error('AI仍在读取包内容，原包已保留，可重试或缩小包内容')
      const more:Record<string,string>={};for(const p of result.read){if(typeof p!=='string')continue;safeLocalPath(p);const b=files.get(p);more[p]=b?b.includes(0)?'二进制文件，运行时从resources/source读取':b.toString('utf8'):'文件不存在'}
      prompt=JSON.stringify({filename:label,inventory,contents:{...contents,...more}});Object.assign(contents,more)
      progress('正在读取包内代码并适配…')
    }
  }else if(skill){
    const guidance=files.get(skill)!.toString('utf8')
    result={name:guidance.match(/^name:\s*(.+)$/m)?.[1]??title,description:guidance.match(/^description:\s*(.+)$/m)?.[1]??'导入的本地技能',instructions:guidance,needsModel:true,actions:[{id:'run',name:'使用技能',description:'按技能要求处理输入；输入JSON包含任务和资料'}],files:{'adapter.cjs':`exports.execute=async({input,api})=>api.model(${JSON.stringify(guidance)}+'\\n用户任务：'+JSON.stringify(input));`}}
    if([...files.keys()].some(p=>/\.(py|sh|ps1|cjs|mjs|js|ts)$/i.test(p)))throw new Error('此技能附带脚本，请开启“使用 AI 处理”以接通脚本执行；原包已保留')
  }else throw new Error('此包需要整理执行入口，请开启“使用 AI 处理”后继续；原包已保留')
  if(result!.error)throw new Error(String(result!.error))
  if(!result!.files||typeof result!.files['adapter.cjs']!=='string')throw new Error('AI尚未生成执行入口，原包已保留，请重试')
  const output=new Map<string,Buffer>()
  for(const [p,b] of files)output.set('resources/source/'+p,b)
  for(const [p,code] of Object.entries(result!.files)){safeLocalPath(p);if(typeof code!=='string')continue;output.set('runtime/'+p,Buffer.from(code))}
  const rawActions=Array.isArray(result!.actions)&&result!.actions.length?result!.actions:[{id:'run',name:'运行',description:'处理输入'}]
  const actions=rawActions.map((a:any,i:number)=>({id:slug(a.id,'action-'+i),name:String(a.name??a.id??'运行'),description:String(a.description??'处理输入')}))
  const manifest:CapabilityManifest={schema:1,protocol:'dsh-worker-v1',id:'local.import.'+sha256(identity).slice(0,24).replace(/^([0-9])/,'p$1'),version:'1.0.0',name:String(result!.name??title),description:String(result!.description??''),instructions:String(result!.instructions??''),author:String(pkg.author?.name??pkg.author??'本地导入'),license:String(pkg.license??'随原包许可'),permissions:result!.needsModel?['node','model']:['node'],components:[{id:'main',name:String(result!.name??title),entry:'runtime/adapter.cjs',actions}],files:Object.fromEntries([...output].map(([p,b])=>[p,sha256(b)]))}
  const bytes=Buffer.from(canonical(manifest)),hash=sha256(bytes);output.set('capability.json',bytes)
  return {manifest,hash,files:output,bytes:[...output.values()].reduce((n,b)=>n+b.length,0)}
}
