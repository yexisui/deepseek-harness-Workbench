import {it,expect} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {readSkillArchive,readSkillTar} from '../src/skill-archive.ts'
import {ManagedSkills} from '../src/managed.ts'
it('reads 7z, tar and compressed tar without installing skills',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'skill-archive-'))
 try{fs.writeFileSync(path.join(root,'SKILL.md'),'---\nname: demo\ndescription: demo\n---\nhello');fs.writeFileSync(path.join(root,'中文.txt'),'资源')
 for(const [ext,args] of [['7z',['--format=7zip']],['tar',[]],['tgz',['-z']],['tar.bz2',['-j']],['tar.xz',['-J']],['tar.Z',['-Z']]] as [string,string[]][]){
 const file=path.join(root,'demo.'+ext),r=spawnSync('tar',['-cf',file,...args,'-C',root,'SKILL.md','中文.txt']);expect(r.status,r.stderr.toString()).toBe(0)
 const files=readSkillArchive(file);expect(files.get('中文.txt')?.toString()).toBe('资源')
 const service=new ManagedSkills(path.join(root,'home'),()=>[]),preview=service.inspect({scope:'global',files:[{path:'demo.'+ext,data:fs.readFileSync(file).toString('base64')}]});expect(preview.candidates[0]).toMatchObject({name:'demo',fileCount:2});expect(service.read().skills).toHaveLength(0)
 }
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})
it('rejects links and parent paths in converted streams',()=>{
 for(const [name,kind] of [['../evil','0'],['link','2']]){const b=Buffer.alloc(1024);b.write(name);b.write('00000000000',124);b.write(kind,156);expect(()=>readSkillTar(b)).toThrow()}
})
it.skipIf(!process.env.SKILL_TEST_RAR)('previews the user RAR with all Chinese resources, without importing',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'skill-rar-'))
 try{const service=new ManagedSkills(root,()=>[]),p=service.inspect({scope:'global',files:[{path:'workload-estimator.rar',data:fs.readFileSync(process.env.SKILL_TEST_RAR!).toString('base64')}]});expect(p.candidates[0]).toMatchObject({name:'workload-estimator',fileCount:4,error:undefined});expect(service.read().skills).toHaveLength(0);const files=readSkillArchive(process.env.SKILL_TEST_RAR!);expect(files.has('workload-estimator/assets/工作量估算表-模板.xlsx')).toBe(true)}finally{fs.rmSync(root,{recursive:true,force:true})}
})
