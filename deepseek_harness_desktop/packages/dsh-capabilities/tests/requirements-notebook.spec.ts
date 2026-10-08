import {afterEach,expect,it} from 'vitest'
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {RequirementsService} from '../src/host/requirements.ts'
import {initialState} from '../src/core/model.ts'
import {REQUIREMENTS_ROLE_ID,requirementMarkdown,type RequirementCommand,type RequirementTask} from '../src/core/requirements-model.ts'
const roots:string[]=[],services:RequirementsService[]=[]
afterEach(async()=>{for(const s of services.splice(0))await s.close();for(const root of roots.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())+'/')&&!resolve(root).startsWith(resolve(tmpdir())+'\\'))throw Error('unsafe');await rm(root,{recursive:true,force:true})}})
async function setup(model=async(_prompt:string)=>JSON.stringify({summary:'已更新',items:[],sections:[{id:'problem',content:'按钮无法保存'}]})){
 const root=await mkdtemp(join(tmpdir(),'dsh-notebook-'));roots.push(root);const project=join(root,'project');await mkdir(project)
 const service=new RequirementsService(join(root,'data'),model,()=>initialState(),()=> 'test/model');services.push(service);await service.init()
 const task=await service.create({roleId:REQUIREMENTS_ROLE_ID,title:'保存功能'})
 const command=(t:RequirementTask,c:RequirementCommand)=>service.command(t.id,t.revision,c)
 return {root,project,service,task,command}
}
async function finish(service:RequirementsService,id:string){for(let i=0;i<100;i++){const t=await service.get(id);if(t.run?.status!=='running')return t;await new Promise(r=>setTimeout(r,5))}throw Error('timeout')}
it('imports more than 100 materials atomically, deduplicates and preserves replaced revisions',async()=>{
 const e=await setup(),materials=Array.from({length:205},(_,i)=>({name:`file${i}.py`,kind:'txt' as const,text:`print(${i})`}))
 let t=await e.command(e.task,{type:'materials.import',materials});expect(t.materials).toHaveLength(205)
 t=await e.command(t,{type:'materials.import',materials});expect(t.materials).toHaveLength(205);expect(t.materials[0].revision).toBe(1)
 t=await e.command(t,{type:'materials.import',materials:[{...materials[0],text:'print("changed")'}]});expect(t.materials[0].history[0].text).toBe('print(0)');expect(t.materials[0].revision).toBe(2)
 await expect(e.command(t,{type:'materials.import',materials:[{name:'valid.txt',kind:'txt',text:'new content'},{name:'invalid.txt',kind:'txt',text:'\0'}]})).rejects.toThrow()
 expect((await e.service.get(t.id)).materials).toEqual(t.materials)
})
it('lists over 400 project files and imports multiple selected paths in one command',async()=>{
 const e=await setup();for(let i=0;i<405;i++)await writeFile(join(e.project,`f${i}.py`),`print(${i})`)
 let t=await e.command(e.task,{type:'project.attach',path:e.project,ledger:false});expect(t.project?.files).toHaveLength(405)
 t=await e.command(t,{type:'project.importMany',paths:['f0.py','f404.py']});expect(t.materials.map(x=>x.name)).toEqual(['f0.py','f404.py'])
 await expect(e.command(t,{type:'project.importMany',paths:['f1.py','../outside.py']})).rejects.toThrow('请选择')
 expect((await e.service.get(t.id)).materials).toEqual(t.materials)
})
it('shares selected, custom and reordered sections across modes, preserving deselected and explicitly cleared content',async()=>{
 const e=await setup();expect(e.task.mode).toBe('quick');expect(e.task.sections?.filter(s=>s.enabled)).toHaveLength(6)
 let t=await e.command(e.task,{type:'save',overview:{...e.task.overview,background:'旧背景'}})
 const rows=t.sections!.map(s=>({...s,content:s.id==='problem'?'保留内容':'',enabled:s.id!=='problem'})).reverse()
 rows.unshift({id:'custom',title:'业务边界',guidance:'明确边界',content:'本次只调整保存',enabled:true})
 t=await e.command(t,{type:'sections.save',sections:rows,baseDataRevision:t.dataRevision})
 expect(requirementMarkdown(t,'standard',[])).not.toContain('业务边界');expect(requirementMarkdown(t)).not.toContain('保留内容');expect(requirementMarkdown(t)).toContain('业务边界')
 const before=structuredClone(t.sections);t=await e.command(t,{type:'save',mode:'guided'});expect(t.sections).toEqual(before)
 t=await e.command(t,{type:'sections.save',sections:t.sections!.map(s=>({...s,enabled:true,content:s.id==='problem'?'':s.content}))})
 expect(requirementMarkdown(t)).not.toContain('旧背景')
 await expect(e.command(t,{type:'sections.save',sections:rows,baseDataRevision:0})).rejects.toMatchObject({status:409})
})
it('automatically applies selected model sections, restores previous content and preserves discussion',async()=>{
 const e=await setup();let t=await e.command(e.task,{type:'run',operation:'analyze',instruction:'按钮无法保存',requestId:randomUUID()});t=await finish(e.service,t.id)
 expect(t.run?.status,t.run?.error).toBe('ready');expect(t.sections![0].content).toBe('按钮无法保存');expect(t.document?.markdown).toContain('按钮无法保存')
 const messages=structuredClone(t.messages);t=await e.command(t,{type:'revision.restore',id:t.revisions![0].id})
 expect(t.sections![0].content).toBe('');expect(t.messages).toEqual(messages);expect(t.revisions).toHaveLength(2)
})
it('reuses the ledger without overwriting other tasks or outside text and imports only chosen project files',async()=>{
 const e=await setup();const ledger=join(e.project,'perf_plan.md');await writeFile(ledger,'# 原台账\n已有结论\n');await writeFile(join(e.project,'notes.md'),'业务参考');await writeFile(join(e.project,'ai_key.txt'),'ignored')
 let t=await e.command(e.task,{type:'project.attach',path:e.project,ledger:true});expect(t.project?.ledgerName).toBe('perf_plan.md');expect(t.project?.files).not.toContain('ai_key.txt');expect(t.materials.some(m=>m.name==='notes.md')).toBe(false)
 t=await e.command(t,{type:'project.import',path:'notes.md'});expect(t.materials.at(-1)?.text).toBe('业务参考')
 await expect(e.command(t,{type:'project.import',path:'../notes.md'})).rejects.toThrow('请选择')
 const other=await e.service.create({roleId:REQUIREMENTS_ROLE_ID,title:'另一个需求'});await e.command(other,{type:'project.attach',path:e.project,ledger:true})
 t=await e.command(t,{type:'sections.save',sections:t.sections!.map(s=>({...s,content:'本次更新'}))})
 const text=await readFile(ledger,'utf8');expect(text.startsWith('# 原台账\n已有结论\n')).toBe(true);expect(text).toContain(other.id);expect(text.match(new RegExp('requirements:'+t.id+':start','g'))).toHaveLength(1)
 await e.command(t,{type:'project.detach'});expect(await readFile(ledger,'utf8')).toBe(text)
})
it('supports read-only association and keeps saved work when ledger synchronization fails',async()=>{
 const e=await setup();let t=await e.command(e.task,{type:'project.attach',path:e.project,ledger:false});await expect(readFile(join(e.project,'PERF_PLAN.md'))).rejects.toMatchObject({code:'ENOENT'})
 await writeFile(join(e.project,'PERF_PLAN.md'),'<!-- requirements:'+t.id+':start -->\n边界损坏')
 t=await e.command(t,{type:'project.attach',path:e.project,ledger:true});expect(t.project?.error).toContain('边界不完整');expect((await e.service.get(t.id)).project?.error).toBe(t.project?.error)
 expect(await readFile(join(e.project,'PERF_PLAN.md'),'utf8')).toContain('边界损坏')
 await writeFile(join(e.project,'PERF_PLAN.md'),'已手动修复\n');t=await e.command(t,{type:'project.refresh'});expect(t.project?.error).toBeUndefined()
})
it('migrates old tasks lazily without changing persisted originals on read',async()=>{
 const e=await setup();const old={...e.task,overview:{...e.task.overview,background:'历史背景'}};delete old.sections;delete old.revisions
 const file=join(e.root,'data',old.id+'.json'),raw=JSON.stringify(old);await writeFile(file,raw)
 expect((await e.service.get(old.id)).sections![0].content).toBe('历史背景');expect(await readFile(file,'utf8')).toBe(raw)
})
