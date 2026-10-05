import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { entryKey, initialClassification, validateClassification, type Classification, type InventoryEntry } from '../core/classification.ts'
import type { ClassificationReport } from '../core/ai-classification.ts'
export class ClassificationStore {
  readonly file: string
  constructor(home:string){this.file=join(home,'plugin-management','classification.json')}
  read(entries:InventoryEntry[]):Classification {
    if(existsSync(this.file))return validateClassification(JSON.parse(readFileSync(this.file,'utf8')))
    const initial=initialClassification(entries);this.write(initial);return initial
  }
  save(input:unknown,entries:InventoryEntry[]):Classification {
    const next=validateClassification(input),current=this.read(entries)
    if(current.revision!==next.revision)throw Error('分类已在其他窗口修改，请重新加载后编辑。')
    const meta=this.metadata()
    next.revision++
    for(const key of new Set([...Object.keys(current.assignments),...Object.keys(next.assignments)]))if(current.assignments[key]!==next.assignments[key])meta.assignmentRevisions[key]=next.revision
    this.write({...next,...meta});return next
  }
  private metadata():{assignmentRevisions:Record<string,number>;aiClassification?:ClassificationReport}{
    if(!existsSync(this.file))return {assignmentRevisions:{}}
    const raw=JSON.parse(readFileSync(this.file,'utf8'))
    return {assignmentRevisions:raw.assignmentRevisions??{},...(raw.aiClassification?{aiClassification:raw.aiClassification}:{})}
  }
  aiSnapshot(entries:InventoryEntry[]){const classification=this.read(entries);return {classification,revisions:this.metadata().assignmentRevisions}}
  report():ClassificationReport|undefined{return this.metadata().aiClassification}
  applyAI(report:ClassificationReport,baseline:ReturnType<ClassificationStore['aiSnapshot']>,entries:InventoryEntry[]):ClassificationReport{
    const current=this.read(entries),meta=this.metadata(),live=new Set(entries.map(entryKey)),valid=new Set(current.modules.map(m=>m.id))
    const next=structuredClone(report);current.revision++
    for(const item of next.results){
      if(item.status!=='applied'||!item.moduleId)continue
      const module=current.modules.find(m=>m.id===item.moduleId)
      if(!live.has(item.key)||!module||valid.has(current.assignments[item.key]??'')||(meta.assignmentRevisions[item.key]??0)!==(baseline.revisions[item.key]??0)){
        item.status='skipped';item.reason='条目或分类已发生变化，保留当前状态';continue
      }
      current.assignments[item.key]=item.moduleId;meta.assignmentRevisions[item.key]=current.revision;item.appliedRevision=current.revision
      item.target=[current.groups.find(g=>g.id===module.groupId)?.name,module.name].filter(Boolean).join(' → ')
    }
    this.write({...current,...meta,aiClassification:next});return next
  }
  undoAI(id:string,entries:InventoryEntry[]):ClassificationReport{
    const current=this.read(entries),meta=this.metadata(),report=meta.aiClassification
    if(!report||report.id!==id)throw Error('只能撤销最近一次自动分类，请刷新结果。')
    if(report.undone)return report
    const next=structuredClone(report),live=new Set(entries.map(entryKey));current.revision++
    for(const item of next.results){if(item.status!=='applied')continue
      if(!live.has(item.key)||current.assignments[item.key]!==item.moduleId||meta.assignmentRevisions[item.key]!==item.appliedRevision){item.status='skipped';item.reason='之后已有修改或插件已移除，未覆盖当前归属';continue}
      current.assignments[item.key]='';meta.assignmentRevisions[item.key]=current.revision;item.status='undone'
    }
    next.undone=true;this.write({...current,...meta,aiClassification:next});return next
  }
  private write(value:Classification & {assignmentRevisions?:Record<string,number>;aiClassification?:ClassificationReport}){mkdirSync(dirname(this.file),{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2));renameSync(tmp,this.file)}
}
