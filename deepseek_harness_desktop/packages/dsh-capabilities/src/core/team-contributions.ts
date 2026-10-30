import { rolePresentation, type State } from './model.ts'
import type { RoleIconSpec } from './appearance.ts'

export type ContributionKind = 'capability' | 'skill' | 'role'
export type ContributionMember = { id: string; employeeId: string; name: string; department: string }
export type ContributionEntry = { key: string; id: string; kind: ContributionKind; name: string; description: string; enabled: boolean; archived: boolean; source: string; related: string[]; color?: string; icon?: RoleIconSpec }
export type ContributionCount = { count: number; lastAt: string }
export type ContributionSnapshot = { revision: number; members: ContributionMember[]; owners: Record<string,string | string[]>; multipleOwners?: boolean; entries: ContributionEntry[]; counts: Record<string,ContributionCount>; startedAt: string; syncedAt: string; warning: string }
/** Accept the previous single-owner snapshot while an installed host is awaiting restart. */
export const contributionOwnerIds = (value: string | string[] | undefined): string[] => Array.isArray(value) ? value : value ? [value] : []
export type ContributionReporter = (kind: ContributionKind, id: string, eventId?: string) => void
export const contributionKey = (kind: ContributionKind, id: string) => `${kind}:${id}`
export const contributionLabels: Record<ContributionKind,string> = { capability: '能力', skill: 'Skills', role: '岗位助手' }
export const contributionMetrics: Record<ContributionKind,string> = { capability: '调用次数', skill: '加载次数', role: '执行轮次' }
type SkillSummary = { id: string; name: string; description: string; enabled: boolean; removed?: boolean; scope: string; usage?: string }

/** A projection of the source catalogs. Never writes or copies business definitions. */
export function contributionCatalog(state: State, skills: SkillSummary[]): ContributionEntry[] {
  const entries: ContributionEntry[] = []
  for (const cap of state.capabilities.filter(c => !c.removedAt && !c.purgedAt)) entries.push({ key: contributionKey('capability',cap.id), id:cap.id, kind:'capability', name:cap.draft.name, description:cap.draft.description, enabled:cap.enabled, archived:false, source:cap.source==='builtin'?'平台内置':'本地导入', related:[] })
  for (const skill of skills.filter(s => !s.removed)) entries.push({ key:contributionKey('skill',skill.id), id:skill.id, kind:'skill', name:skill.name, description:skill.description, enabled:skill.enabled, archived:false, source:skill.scope==='global'?'全局技能':'项目技能', related:[] })
  for (const role of state.roles.filter(r => !r.removedAt)) {
    const definition=rolePresentation(role)
    entries.push({key:contributionKey('role',role.id),id:role.id,kind:'role',name:definition.name,description:definition.duties,enabled:role.enabled,archived:!!role.archivedAt,source:'Agent 预设',color:definition.color,icon:definition.icon,related:[...definition.capabilities.filter(b=>b.enabled).map(b=>contributionKey('capability',b.capabilityId)),...(definition.skills??[]).filter(b=>b.enabled).map(b=>contributionKey('skill',b.id))]})
  }
  const keys=new Set(entries.map(e=>e.key))
  for (const entry of entries) entry.related=entry.kind==='role'?entry.related.filter(k=>keys.has(k)):entries.filter(e=>e.kind==='role'&&!e.archived&&e.related.includes(entry.key)).map(e=>e.key)
  return entries
}

/** RFC-style CSV quoting, including Excel BOM; TSV paste is supported as well. */
export function parseMemberImport(input: string): Omit<ContributionMember,'id'>[] {
  if(input.length>256000)throw Error('名单不能超过 256 KB')
  const text=input.replace(/^\uFEFF/,'').trim(), delimiter=text.split(/\r?\n/,1)[0]?.includes('\t')?'\t':','
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false
  for(let i=0;i<text.length;i++){const c=text[i]!;if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(quoted||!cell)quoted=!quoted;else throw Error('名单引号格式不正确')}else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){row.push(cell.trim());cell='';if(c!==delimiter){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[]}}else cell+=c}
  if(quoted)throw Error('名单引号未闭合');row.push(cell.trim());if(row.some(Boolean))rows.push(row)
  const header=rows.shift()??[],names=['工号','姓名','部门'],columns=names.map(n=>header.indexOf(n))
  if(columns.some(i=>i<0))throw Error('第一行需要包含：工号、姓名、部门')
  if(!rows.length||rows.length>1000)throw Error('每次可导入 1–1000 位成员')
  return rows.map((r,i)=>{if(r.length!==header.length)throw Error(`第 ${i+2} 行列数不正确`);return {employeeId:r[columns[0]!]!,name:r[columns[1]!]!,department:r[columns[2]!]!}})
}
