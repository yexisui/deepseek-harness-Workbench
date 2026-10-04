import {afterEach,expect,it} from 'vitest'
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {JevStore} from '../../dsh-jev-mode/src/host/store.ts'
import {JevService} from '../../dsh-jev-mode/src/host/service.ts'
import {defaults,type Decision,type JevBackend} from '../../dsh-jev-mode/src/core/contract.ts'
import {RequirementsService} from '../src/host/requirements.ts'
import {DeveloperService} from '../src/host/developer.ts'
import {MeetingService,type MeetingJob} from '../src/host/meeting.ts'
import {GitService,type GitRunner} from '../../dsh-git-graph/src/host/git-service.ts'
import {initialState} from '../src/core/model.ts'
import {REQUIREMENTS_ROLE_ID} from '../src/core/requirements-model.ts'
const roots:string[]=[],cleanup:(()=>Promise<unknown>|void)[]=[]
afterEach(async()=>{for(const fn of cleanup.splice(0))await fn();for(const root of roots.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())))throw Error('Unsafe cleanup');await rm(root,{recursive:true,force:true})}})
const allow:Decision={decision:'allow',summary:'依据一致',missing:[],checks:[{criterion:'输入依据',verdict:'supported',evidence:'用户提供的资料'}]}
async function setup(assess:JevBackend['assess']){const root=await realpath(await mkdtemp(join(tmpdir(),'jev-adapter-')));roots.push(root);const store=new JevStore(join(root,'jev'));await store.init();await store.update(0,{...defaults,enabled:true,model:'lan/decision'});const jev=new JevService(store,{id:'self-owned',assess},()=>{});cleanup.push(()=>store.close());return{root,store,jev,state:initialState()}}
async function until<T>(read:()=>Promise<T>,done:(value:T)=>boolean){for(let i=0;i<200;i++){const value=await read();if(done(value))return value;await new Promise(r=>setTimeout(r,20))}throw Error('Fixture did not finish')}
it('requirements uses one decision snapshot and does not apply a rejected result',async()=>{
 const stages:string[]=[];const env=await setup(async input=>{stages.push(input.stage);return input.stage==='review'?{...allow,decision:'block',summary:'来源不足'}:allow})
 const service=new RequirementsService(join(env.root,'requirements'),async(prompt,model)=>{expect(prompt).toContain('JEV 本轮');expect(model).toBe('role/generator');await env.store.update(1,{...defaults,enabled:false,model:'different/next'});return JSON.stringify({summary:'建议',items:[]})},()=>env.state,()=> 'role/generator',env.jev);cleanup.unshift(()=>service.close());await service.init()
 const task=await service.create({roleId:REQUIREMENTS_ROLE_ID,title:'需求'});await service.command(task.id,task.revision,{type:'run',operation:'analyze',requestId:randomUUID(),instruction:'整理目标'})
 const result=await until(()=>service.get(task.id),t=>t.run?.status!=='running');expect(result.run?.status).toBe('error');expect(result.proposal).toBeUndefined();expect(stages).toEqual(['begin','review']);expect(env.store.history().every(t=>t.config.model==='lan/decision')).toBe(true)
})
it('meeting review failure preserves the previous minutes',async()=>{
 const env=await setup(async input=>input.stage==='review'?{...allow,decision:'clarify',summary:'负责人没有依据'}:allow)
 const service=new MeetingService(join(env.root,'meeting'),async prompt=>{expect(prompt).toContain('JEV 本轮');return JSON.stringify({title:'新纪要',overview:'讨论',decisions:[],actions:[],unknown:[]})},undefined,undefined,()=>({endpoint:'http://127.0.0.1:9000/v1/audio/transcriptions',model:'fixture'}),env.jev);await service.init()
 const task=await service.create({fileName:'fixture.wav',mode:'guided'}),old={title:'旧纪要',overview:'已核对',decisions:[],actions:[],unknown:[]}
 const job:MeetingJob={...task,status:'ready',segments:[{id:'s1',start:0,end:1000,speaker:'甲',text:'讨论项目'}],minutes:old};await writeFile(join(env.root,'meeting',job.id+'.json'),JSON.stringify(job))
 await service.generate(job.id);const result=await until(()=>service.get(job.id),t=>t.status!=='generating');expect(result.status).toBe('error');expect(result.minutes).toEqual(old);expect(env.store.history().map(t=>t.stage)).toEqual(['begin','review'])
})
it('developer action denial leaves the real file untouched and records a failed round',async()=>{
 const env=await setup(async input=>input.stage==='action'?{...allow,decision:'block',summary:'修改超出用户要求'}:allow),repo=join(env.root,'repo');await mkdir(repo)
 const exec=promisify(execFile),runner:GitRunner={async run(args,cwd){try{const r=await exec('git',['-c','user.name=QA','-c','user.email=qa@example.invalid',...args],{cwd,encoding:'utf8',windowsHide:true});return{exitCode:0,...r}}catch(e){const r=e as any;return{exitCode:r.code,stdout:r.stdout,stderr:r.stderr}}}}
 await runner.run(['init'],repo);await writeFile(join(repo,'main.ts'),'original');await runner.run(['add','.'],repo);await runner.run(['commit','-m','baseline'],repo)
 const git=new GitService(runner,async p=>p===repo?{ok:true,canonical:repo}:{ok:false,error:{code:'workspace-unknown',message:'denied'}});let n=0
 const service=new DeveloperService(join(env.root,'developer'),git,async()=>JSON.stringify([{action:'read',path:'main.ts'},{action:'write',path:'main.ts',content:'changed'}][n++]),async()=>0,()=>env.state,env.jev);cleanup.unshift(async()=>{await service.close();git.workspace.close()});await service.init()
 let task=await service.create({requestId:randomUUID(),cwd:repo,roleId:'builtin-developer',roleVersion:1});task=await service.configureTask(task.id,task.revision,{permission:'edit'});await service.send(task.id,{requestId:randomUUID(),message:'检查文件'})
 const result=await until(()=>service.get(task.id),t=>t.rounds[0]?.status!=='running');expect(result.rounds[0]?.status).toBe('failed');expect(result.rounds[0]?.writes).toEqual([]);expect(await readFile(join(repo,'main.ts'),'utf8')).toBe('original');expect(env.store.history().at(-1)?.status).toBe('blocked')
},30000)
