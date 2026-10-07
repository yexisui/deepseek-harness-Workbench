// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {config,defaults,candidates} from '../src/core/contract.ts'
import {JevStore} from '../src/host/store.ts'
import {accountCatalog} from '../src/host/backend.ts'
const roots:string[]=[]
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})))})
const rows=[{id:'one',model:'lan/one',enabled:false,reasoningEffort:'' as const}]
it('distinguishes an intentionally empty candidate list from a legacy selected model',()=>{
  expect(candidates({...defaults,model:'lan/old',candidates:[]})).toEqual([])
  expect(candidates({...defaults,model:'lan/old'})[0]?.enabled).toBe(true)
  expect(config({...defaults,candidates:rows}).candidates).toEqual(rows)
  expect(()=>config({...defaults,candidates:[...rows,{...rows[0],id:'two'}]})).toThrow('重复')
  expect(()=>config({...defaults,candidates:[{...rows[0],enabled:'false'}]})).toThrow('无效')
})
it('backs up the previous single model once and retains candidate order and disabled state across restart',async()=>{
  const root=await mkdtemp(join(tmpdir(),'jev-candidates-'));roots.push(root);const store=new JevStore(root);await store.init()
  const old=await store.update(0,{...defaults,model:'lan/old'});await store.update(1,{...defaults,candidates:rows})
  const restored=new JevStore(root);await restored.init();expect(restored.snapshot()).toMatchObject({schema:2,value:{candidates:rows}})
  expect(JSON.parse(await readFile(join(root,'config.before-candidates.json'),'utf8'))).toEqual(old)
  await restored.update(2,{...defaults,candidates:[]});expect(JSON.parse(await readFile(join(root,'config.before-candidates.json'),'utf8'))).toEqual(old)
})
it('lists added accounts even when ineligible, omits dormant providers and never discovers arbitrary models',async()=>{
  const listModels=vi.fn(async()=>[{id:'deepseek-flash',name:'DeepSeek-V41-Flash'}])
  const routes=[{provider:'deepseek-official',displayName:'DeepSeek',settingsNs:'deepseek',settingsPath:[]},{provider:'lan',displayName:'内网',settingsNs:'lan',settingsPath:[],declared:true},{provider:'dormant',displayName:'未添加',settingsNs:'empty',settingsPath:[],declared:false}]
  const profiles:any={deepseek:{apiKey:'never-return-me'},lan:{baseURL:'http://127.0.0.1/v1',models:[{id:'one',name:'内网模型'}]}}
  const ctx:any={get:(name:string)=>name==='llm'?{stream:vi.fn(),listProviders:()=>[{id:'deepseek-official'}],listConfigurableProviders:()=>routes,listModels}:name==='settings'?{get:(id:string)=>profiles[id]}:undefined}
  const result=await accountCatalog(ctx);expect(result.map(a=>a.id)).toEqual(['deepseek-official','lan'])
  expect(result[0]).toMatchObject({available:true,models:[{id:'deepseek-official/deepseek-flash'}]});expect(result[1]?.available).toBe(false);expect(result[1]?.message).toContain('未启用')
  expect(listModels).toHaveBeenCalledExactlyOnceWith('deepseek-official');expect(JSON.stringify(result)).not.toContain('never-return-me')
})
