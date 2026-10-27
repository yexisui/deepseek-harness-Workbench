import {it,expect,afterEach} from 'vitest'
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {emptyTemplateWorkspace,type TemplateVersion} from '../src/core/requirement-template.ts'
import {templateVersionLabel,templateEditions} from '../src/core/requirement-versions.ts'
import {templateVersion,editTemplate} from '../src/host/requirement-template-work.ts'
import {saveRequirementOutput,requirementOutputFolder} from '../src/host/requirement-output.ts'
import type {RequirementTask} from '../src/core/requirements-model.ts'

const roots:string[]=[]
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))})
const labels=(versions:TemplateVersion[])=>versions.map(v=>templateVersionLabel(versions,v))
function fixture(){
 const w=emptyTemplateWorkspace();templateVersion(w,'原始模板')
 const add=(action:'generate'|'revise',value:string,baseId?:string)=>{w.values={p:value};templateVersion(w,action==='generate'?'生成初稿':'按要求修改',undefined,{action,baseId});return w.versions.at(-1)!}
 return {w,add}
}
it('separates new editions, AI revisions and manual saves, preserving the chronological IDs',()=>{
 const {w,add}=fixture();add('generate','初稿');add('revise','修改一');w.values.p='手动修改';templateVersion(w);add('generate','重新生成');add('revise','修改二')
 expect(labels(w.versions)).toEqual(['V0','V1','V1.1','V1.2','V2','V2.1'])
 expect(w.versions.map(v=>v.number)).toEqual([0,1,2,3,4,5]);expect(new Set(w.versions.map(v=>v.id)).size).toBe(6)
 expect(w.versions[2]!.parentId).toBe(w.versions[1]!.id);expect(w.versions[1]!.values).toEqual({p:'初稿'})
})
it('continues the selected older family and allocates the next major globally',()=>{
 const {w,add}=fixture(),v1=add('generate','一');add('revise','一改');add('generate','二');add('revise','二改');add('revise','回改一',v1.id)
 expect(labels(w.versions).at(-1)).toBe('V1.2');expect(w.versions.at(-1)!.parentId).toBe(v1.id)
 add('generate','新三',v1.id);expect(labels(w.versions).at(-1)).toBe('V3')
})
it('keeps integer minor counters beyond nine and does not allocate versions for unchanged saves',()=>{
 const {w,add}=fixture();add('generate','初稿');for(let i=1;i<=11;i++)add('revise','修改'+i)
 expect(labels(w.versions).slice(-3)).toEqual(['V1.9','V1.10','V1.11'])
 templateVersion(w);expect(w.versions).toHaveLength(13)
 add('generate','修改11');expect(labels(w.versions).at(-1)).toBe('V2')
})
it('resolves known legacy labels without mutating old history or guessing unknown operations',()=>{
 const versions=['原始模板','生成初稿','按要求修改','保存文档','生成初稿','手动修改','从 V1 恢复','自定义旧标签'].map((label,number)=>({id:'v'+number,number,label,at:'',values:{p:''+number},note:''}))
 const before=structuredClone(versions)
 expect(labels(versions)).toEqual(['V0','V1','V1.1','V1.2','V2','V2.1','V1.3','V7'])
 expect(versions).toEqual(before);expect(templateEditions(versions).get('v6')!.parentId).toBe('v1')
})
it('restores an older edition as its next minor without modifying either saved document',()=>{
 const {w,add}=fixture(),v1=add('generate','一');add('revise','一改');add('generate','二');const before=structuredClone(w.versions)
 editTemplate({template:w} as RequirementTask,{type:'template.restore',id:v1.id})
 expect(labels(w.versions).at(-1)).toBe('V1.2');expect(w.versions.at(-1)!.label).toBe('从 V1 恢复');expect(w.versions.slice(0,-1)).toEqual(before)
})
it('reserves historical file names and retains external edits when an old V2 becomes V1.1',async()=>{
 const root=await mkdtemp(join(tmpdir(),'requirement-version-files-'));roots.push(root)
 const versions=['原始模板','生成初稿','按要求修改'].map((label,number)=>({id:'old'+number,number,label,title:'访客系统',at:'',values:{p:''+number},note:''}))
 const w={...emptyTemplateWorkspace(),versions,template:{id:'template1',name:'API报告.docx',kind:'docx' as const,enabled:true,slots:[]}},task={id:'task',title:'访客系统',template:w} as RequirementTask
 const folder=requirementOutputFolder(root,task);await mkdir(folder,{recursive:true});const legacy=join(folder,'V2_访客系统.docx');await writeFile(legacy,'old external edit')
 w.product='访客系统';w.values={p:'new edition'};templateVersion(w,'生成初稿',undefined,{action:'generate'});const fresh=w.versions.at(-1)!
 // Open the new V2 first; then open the old revision. Neither can shadow the other.
 const file=await saveRequirementOutput(root,task,fresh,'docx',Buffer.from('new V2'))
 expect(file).not.toBe(legacy);expect(await readFile(file,'utf8')).toBe('new V2')
 const oldFile=await saveRequirementOutput(root,task,w.versions[2]!,'docx',Buffer.from('old generated version'))
 expect(oldFile).toBe(join(folder,'V1.1_访客系统.docx'));expect(await readFile(oldFile,'utf8')).toBe('old external edit');expect(await readFile(legacy,'utf8')).toBe('old external edit')
 expect(await saveRequirementOutput(root,task,fresh,'docx',Buffer.from('new repeated export'))).toBe(file);expect(await readFile(file,'utf8')).toBe('new V2')
 const pdf=await saveRequirementOutput(root,task,w.versions[2]!,'pdf',Buffer.from('PDF'));expect(pdf).toBe(join(folder,'V1.1_访客系统.pdf'))
})
