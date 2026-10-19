import {afterEach,expect,it} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {CapabilityStore} from '../src/host/store.ts'
import {CapabilityPackages} from '../src/host/packages.ts'
import {PackageRunner} from '../src/host/package-runner.ts'
import {packageResult,servePackageArtifact} from '../src/host/package-artifact.ts'
import {emptyRole} from '../src/core/model.ts'
import {catalogFor} from '../src/core/distribution.ts'
const base=process.env.DSH_EXCEL_ROOT??resolve(import.meta.dirname,'../../../../capability-packages/excel-generation'),cleanups:Array<()=>Promise<unknown>>=[]
afterEach(async()=>{for(const f of cleanups.splice(0).reverse())await f()})
it('imports the generic generator, runs in a real Worker, serves workbook and keeps prior result after failure/restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'excel-capability-'));cleanups.push(()=>rm(dir,{recursive:true,force:true,maxRetries:5}));const store=new CapabilityStore(dir);await store.init();cleanups.push(()=>store.close());const packs=new CapabilityPackages(store,()=> '');await packs.init();cleanups.push(()=>packs.close());const runner=new PackageRunner(packs,async()=>{throw Error('Excel must not call models')});await runner.init();cleanups.push(()=>runner.close());
 const{token}=await packs.start('zip');await packs.put(token,'ability.zip',(async function*(){yield await readFile(join(base,'dist/excel-generation.zip'))})());const preview=await packs.inspect(token);expect(preview.needsModel).toBe(false);const{id}=await packs.install(token,preview.hash,preview.revision,{trusted:true});const cap=store.snapshot().capabilities.find(c=>c.id===id)!,v=cap.versions.at(-1)!,action=v.components[0]!.actions[0]!;expect(catalogFor(store.snapshot()).some(c=>c.name==='Excel 文件生成')).toBe(true);
 const saved=await store.command(store.snapshot().revision,{type:'role.save',definition:{...emptyRole(),name:'Excel验证',capabilities:[{capabilityId:id,version:v.version,enabled:true}]},publish:true,directSave:true});const role=store.snapshot().roles.find(r=>r.id===saved.id)!,authority={roleId:role.id,version:role.versions.at(-1)!,sessionCreatedAt:Date.now()+1,sessionId:'excel-test'};
 const input={fileName:'通用测试.xlsx',sheets:[{name:'数据',rows:[['值',3],['乘2',{formula:'B1*2',result:6}]]}]};const run=await runner.start(id,v.version,action,input,{role:authority}),output:any=await run.done;expect(output.kind).toBe('xlsx');const summary:any=packageResult(run.job.id,output,3082);expect(summary.downloadUrl).toContain('/download.xlsx');expect(summary.base64).toBeUndefined();expect(summary.formulaCount).toBe(1);
 let status=0,headers:any,body:any;servePackageArtifact(runner,run.job.id+'/download.xlsx',{writeHead:(s:number,h:any)=>{status=s;headers=h},end:(b:any)=>{body=b}} as any);expect(status).toBe(200);expect(headers['content-type']).toContain('spreadsheetml');expect(headers['content-disposition']).toContain(encodeURIComponent('通用测试.xlsx'));expect(body.equals(Buffer.from(output.base64,'base64'))).toBe(true);
 await expect((await runner.start(id,v.version,action,{fileName:'../../bad.xlsx',sheets:[]},{role:authority})).done).rejects.toThrow();expect(runner.get(run.job.id).status).toBe('done');await runner.close();const restarted=new PackageRunner(packs,async()=>{throw Error('No model')});await restarted.init();cleanups.push(()=>restarted.close());expect((restarted.get(run.job.id).output as any).base64).toBe(output.base64);
 await store.command(store.snapshot().revision,{type:'capability.toggle',id,enabled:false});await expect(restarted.start(id,v.version,action,input,{role:authority})).rejects.toThrow('未获授权');
 expect(()=>packageResult(run.job.id,{...output,base64:'not-a-workbook'},3082)).toThrow('内容无效');expect(()=>packageResult(run.job.id,{...output,fileName:'x\r\nSet-Cookie: bad.xlsx'},3082)).toThrow('格式无效');
},30000)
