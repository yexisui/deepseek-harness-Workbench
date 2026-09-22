import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { initialClassification, validateClassification, type Classification, type InventoryEntry } from '../core/classification.ts'
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
    next.revision++;this.write(next);return next
  }
  private write(value:Classification){mkdirSync(dirname(this.file),{recursive:true});const tmp=this.file+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value,null,2));renameSync(tmp,this.file)}
}
