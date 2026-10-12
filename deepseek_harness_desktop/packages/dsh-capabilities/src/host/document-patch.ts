import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import type {DocumentContext,DocumentProposal} from '../core/documents-model.ts'
import {InputError,object,text} from '../core/validation.ts'
const require=createRequire(import.meta.url)
type Zip={files:Record<string,unknown>;file(name:string):{asText():string;asNodeBuffer():Buffer}|null}
export function parseDocumentProposal(raw:string,context:DocumentContext,scopeTexts:string[]):DocumentProposal{
 let value:Record<string,unknown>;try{value=object(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'')))}catch{throw new InputError('模型没有返回有效修改建议，请补充要求后重试')}
 const before=text(value.before,'修改原文',20000,true),after=text(value.after,'建议正文',20000),reason=text(value.reason??'按要求改写','修改说明',2000)
 if(before===after)throw new InputError('模型未提出文字变化')
 if(/[\r\n]/.test(before+after))throw new InputError('当前支持段落内的局部改写，请一次选择一个段落中的文字')
 if(!scopeTexts.some(p=>p.includes(before)))throw new InputError('修改超出了所选内容，未改动文档')
 const hits=context.paragraphs.flatMap(p=>{const count=p.text.split(before).length-1;return Array.from({length:count},()=>p)})
 if(hits.length!==1||!hits[0]?.paraId)throw new InputError('原文重复或没有稳定位置，请扩大选区加入可区分的上下文后重试')
 return {id:randomUUID(),before,after,reason,paraId:hits[0].paraId,editorRevision:context.revision,status:'ready'}
}
/** Only two public toolkit tools are captured. No model-supplied tool/path/operation is executed. */
export async function documentCandidate(root:string,bytes:Buffer,proposal:DocumentProposal){
 const Zip=require('pizzip') as new (b:Buffer)=>Zip,original=new Zip(bytes),file=join(root,'proposal-'+proposal.id+'.docx')
 await writeFile(file,bytes,{flag:'wx'})
 const tools=new Map<string,{execute:(args:unknown,exec:unknown)=>Promise<unknown>}>()
 const toolkit=await import('dsh-office-toolkit')
 toolkit.apply({tools:{register(tool:any){if(tool.name==='office_edit_docx'||tool.name==='office_read')tools.set(tool.name,tool);return()=>{}}},get(){return undefined},effect:(run:()=>unknown)=>run()})
 await tools.get('office_edit_docx')!.execute({path:file,ops:[{op:'replace_text',find:proposal.before,replace:proposal.after,limit:1}]},{agent:{session:{header:{cwd:root}}}})
 const result=await readFile(file),candidate=new Zip(result)
 const names=Object.keys(original.files);if(names.length!==Object.keys(candidate.files).length||names.some(n=>!candidate.files[n]))throw new Error('修改引擎改变了文档部件，候选未采用')
 for(const name of names){if(name==='word/document.xml'||name.endsWith('/'))continue;const a=original.file(name),b=candidate.file(name);if(a&&b&&!a.asNodeBuffer().equals(b.asNodeBuffer()))throw new Error('修改影响了其他文档部件，候选未采用')}
 if(original.file('word/document.xml')?.asText()===candidate.file('word/document.xml')?.asText())throw new Error('未在工作副本中找到修改位置')
 return createHash('sha256').update(result).digest('hex')
}
