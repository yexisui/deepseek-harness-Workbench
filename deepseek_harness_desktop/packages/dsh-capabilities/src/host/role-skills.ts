import path from 'node:path'
import {ManagedSkills} from '../../../dsh-skill-explorer/src/managed.ts'
import {safeLocalPath} from '../../../dsh-market/src/core/local-import-safety.ts'
import {allowedRoleSkills} from '../core/policy.ts'
import type {RoleVersion,SkillBinding,State} from '../core/model.ts'

/** Skill resources confer no general filesystem or shell authority. */
export class RoleSkills {
  private managed: ManagedSkills
  constructor(home:string){this.managed=new ManagedSkills(home,()=>[])}
  private version(binding:SkillBinding,cwd?:string){
    const result=this.managed.readVersion(binding.id,binding.hash)
    if(result.row.name!==binding.name)throw Error('技能名称与岗位绑定不一致')
    if(result.row.scope!=='global'){
      const relative=cwd?path.relative(path.resolve(result.row.scope),path.resolve(cwd)):undefined
      if(relative===undefined||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('此技能不属于当前工作项目')
    }
    return result
  }
  private text(bytes:Buffer|undefined,label:string){
    if(!bytes)throw Error('资源不存在：'+label)
    if(bytes.length>128*1024)throw Error('资源过大，无法作为技能文本读取：'+label)
    try {const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw Error();return text}
    catch{throw Error('此资源不是 UTF-8 文本：'+label)}
  }
  load(binding:SkillBinding,cwd?:string){
    try{const {files}=this.version(binding,cwd),content=this.text(files.get('SKILL.md'),'SKILL.md');return JSON.stringify({name:binding.name,content,resources:[...files.keys()].filter(p=>p!=='SKILL.md'),resourceInstructions:'需要引用资料时调用 skill_resource，name 使用本技能名称，path 使用上述相对路径。技能说明不增加工具权限。'})}
    catch(e){throw Error('技能加载失败（'+binding.name+'）：'+(e instanceof Error?e.message:String(e)))}
  }
  resource(binding:SkillBinding,relative:string,cwd?:string){
    try{const file=safeLocalPath(relative),{files}=this.version(binding,cwd);return this.text(files.get(file),file)}
    catch(e){throw Error('技能资源读取失败（'+binding.name+'）：'+(e instanceof Error?e.message:String(e)))}
  }
  /** Specialized workflows receive the same pinned guidance during their actual model request. */
  guidance(state:State,roleId:string,version:RoleVersion,cwd?:string){
    const original=(version.skills??[]).filter(s=>s.enabled);if(!original.length)return ''
    const allowed=allowedRoleSkills(state,roleId,version);const result:unknown[]=[];let total=0
    for(const binding of original){
      if(!allowed.some(b=>b.id===binding.id))throw Error('技能加载失败（'+binding.name+'）：岗位已移除或停用此技能，请新建任务')
      const loaded=JSON.parse(this.load(binding,cwd));const resources:Record<string,string>={}
      for(const name of loaded.resources as string[])if(/\.(md|txt|json|ya?ml|csv)$/i.test(name)){const text=this.resource(binding,name,cwd);total+=text.length;if(total>256*1024)throw Error('技能资源读取失败：绑定资料过大，请精简技能');resources[name]=text}
      total+=loaded.content.length;if(total>256*1024)throw Error('技能加载失败：绑定资料过大，请精简技能')
      result.push({name:binding.name,content:loaded.content,resources})
    }
    return '\n岗位已绑定的技能指导（遵守当前流程的输出协议，不增加工具权限）：\n'+JSON.stringify(result)
  }
}
