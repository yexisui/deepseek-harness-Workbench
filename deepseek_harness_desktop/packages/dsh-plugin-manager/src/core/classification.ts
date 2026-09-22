import seed from './classification-seed.json'

export interface InventoryEntry { entryId: string; moduleName: string; enabled: boolean; fiberPhase: string | null; origin?: string }
export interface CategoryGroup { id: string; name: string }
export interface CategoryModule extends CategoryGroup { groupId: string }
export interface Classification { version: 1; revision: number; groups: CategoryGroup[]; modules: CategoryModule[]; assignments: Record<string,string> }
const dynamic = new Set(['@deepseek-ai/dsh-host-directory-picker-native','@deepseek-ai/dsh-client-ui-directory-picker-native','@deepseek-ai/cordis-plugin-hmr'])
/** Stable module identity plus composition seat; only known adaptive SDK seats ignore generated IDs. */
export function entryKey(entry: Pick<InventoryEntry,'entryId'|'moduleName'>): string {
  const seat=entry.entryId.replace(/^include:/,'')
  return JSON.stringify([entry.moduleName, /^[a-f0-9]{8,}$/i.test(seat) && dynamic.has(entry.moduleName) ? '$adaptive' : seat])
}
const facts = new Map(seed.rows.map(row=>[entryKey(row),row]))
export function entryFacts(entry: Pick<InventoryEntry,'entryId'|'moduleName'|'origin'>) {
  return facts.get(entryKey(entry)) ?? {purpose:'新加入的插件，等待补充分类。',source:entry.origin??'待核实来源',moduleId:''}
}
export function initialClassification(entries: InventoryEntry[]): Classification {
  const assignments: Record<string,string>={}
  for(const entry of entries) { const fact=facts.get(entryKey(entry)); if(fact)assignments[entryKey(entry)]=fact.moduleId }
  return {version:1,revision:0,groups:structuredClone(seed.groups),modules:structuredClone(seed.modules),assignments}
}
export function validateClassification(value: unknown): Classification {
  const c=value as Classification
  if(!c||c.version!==1||!Number.isSafeInteger(c.revision)||c.revision<0||!Array.isArray(c.groups)||!Array.isArray(c.modules)||!c.assignments||typeof c.assignments!=='object'||Array.isArray(c.assignments))throw Error('分类格式无效')
  if(c.groups.length>100||c.modules.length>500||Object.keys(c.assignments).length>10000)throw Error('分类数量超过限制')
  const groups=new Set<string>(),modules=new Set<string>()
  const valid=(x: CategoryGroup)=> x&&typeof x.id==='string'&&/^[a-zA-Z0-9_-]{1,90}$/.test(x.id)&&typeof x.name==='string'&&x.name.trim().length>0&&x.name.length<=80
  for(const g of c.groups){if(!valid(g)||g.id==='undefined'||groups.has(g.id))throw Error('分组名称或标识无效');groups.add(g.id)}
  for(const m of c.modules){if(!valid(m)||!groups.has(m.groupId)||modules.has(m.id))throw Error('模块归属或标识无效');modules.add(m.id)}
  for(const [key,id]of Object.entries(c.assignments)){if(key.length>1500||!key.startsWith('["')||typeof id!=='string'||(id!==''&&!modules.has(id)))throw Error('插件分类指向不存在的模块')}
  return {version:1,revision:c.revision,groups:c.groups.map(g=>({id:g.id,name:g.name.trim()})),modules:c.modules.map(m=>({id:m.id,name:m.name.trim(),groupId:m.groupId})),assignments:Object.fromEntries(Object.entries(c.assignments))}
}
export function removeCategory(c: Classification,id: string,group=false,target=''): Classification {
  const next=structuredClone(c), removed=new Set(group?next.modules.filter(m=>m.groupId===id).map(m=>m.id):[id])
  if(target && (!next.modules.some(m=>m.id===target)||removed.has(target)))throw Error('请选择其他目标模块')
  for(const key of Object.keys(next.assignments))if(removed.has(next.assignments[key]!))next.assignments[key]=target
  next.modules=next.modules.filter(m=>!removed.has(m.id));if(group)next.groups=next.groups.filter(g=>g.id!==id)
  return next
}
