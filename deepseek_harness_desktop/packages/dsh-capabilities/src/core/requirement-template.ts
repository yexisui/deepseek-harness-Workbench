/** Optional document workspace on the existing requirements task; old tasks stay intact. */
export type TemplateSlot = { id:string; part:string; index:number; text:string; style:string; heading:boolean; image:boolean; editable:boolean; table?:number; row?:number; cell?:number }
export type TemplateSource = { id:string; name:string; asset?:string; originalAsset?:string; kind:'docx'|'pdf'|'text'; slots:TemplateSlot[]; enabled:boolean }
export type TemplateCitation = { sourceId:string; blockId:string; name:string; quote:string; locator?:string }
export type TemplateChange = { id:string; before:string; after:string; sources?:TemplateCitation[] }
export type TemplateGroup = { id:string; title:string; reason:string; changes:TemplateChange[]; status:'pending'|'accepted'|'rejected'|'reverted' }
export type TemplateProposal = { evidence?:import('./knowledge.ts').KnowledgeEvidence[]; id:string; instruction:string; summary:string; questions:string[]; groups:TemplateGroup[]; createdAt:string }
/** Valid returned blocks survive partial responses and restarts; publication needs full coverage. */
export type TemplateProgress = {
  plan:string[][]
  baseValues?:Record<string,string>
  baseNote?:string
  newProduct?:boolean
  batches:Record<string,{received?:string[];complete?:boolean;changes:(TemplateChange & {reason:string})[];summary:string;questions:string[];evidence:import('./knowledge.ts').KnowledgeEvidence[]}>
  retrieval:Record<string,import('./knowledge.ts').KnowledgeEvidence[]>
}
/** number is the immutable chronological index; major/minor are the displayed document edition. */
export type TemplateVersion = { major?:number; minor?:number; parentId?:string; title?:string; fileError?:string; evidenceGroups?:{proposalId:string;groupId:string}[]; id:string; number:number; label:string; at:string; values:Record<string,string>; note:string }
export type TemplateAnswer = { runId?:string; evidence?:import('./knowledge.ts').KnowledgeEvidence[]; id:string; question:string; answer:string; at:string; sources:{sourceId:string; blockId:string; name:string; quote:string}[] }
export type TemplateDocumentArchive = {id:string;at:string;template:TemplateSource;values:Record<string,string>;note:string;proposals:TemplateProposal[];versions:TemplateVersion[]}
/** Ended drafts are immutable viewing snapshots, never resume checkpoints. */
export type TemplateEndedDraft = {id:string;at:string;title:string;instruction:string;model:string;template:TemplateSource;values:Record<string,string>;note:string;completedBatches:number;totalBatches:number}
export type TemplateWorkspace = { newDraft?:{id:string}; endedDrafts?:TemplateEndedDraft[]; draftRun?:import('./requirements-model.ts').RequirementRun; knowledge?:import('./knowledge.ts').KnowledgeScope; documents?:TemplateDocumentArchive[];
  product:string; brief:string; intent:'new-product'|'revise'; template?:TemplateSource; sources:TemplateSource[]
  values:Record<string,string>; note:string; proposals:TemplateProposal[]; versions:TemplateVersion[]; answers:TemplateAnswer[]
}
export const emptyTemplateWorkspace=():TemplateWorkspace=>({product:'',brief:'',intent:'new-product',sources:[],values:{},note:'',proposals:[],versions:[],answers:[]})
export type TemplateCommand =
 | {type:'template.draft.new'; runId:string}
 | {type:'template.remove'; id:string}
 | {type:'template.document.restore'; id:string}
 | {type:'template.knowledge'; scope?:import('./knowledge.ts').KnowledgeScope}
 | {type:'template.save'; product:string; brief:string; intent:'new-product'|'revise'}
 | {type:'template.source'; id:string; enabled:boolean}
 | {type:'template.review'; proposalId:string; groupIds:string[]; action:'accept'|'reject'|'revert'}
 | {type:'template.edit'; id:string; before:string; after:string}
 | {type:'template.editMany'; changes:TemplateChange[]}
 | {type:'template.note'; note:string}
 | {type:'template.version'; label?:string}
 | {type:'template.restore'; id:string}
 | {type:'template.run'; action:'generate'|'revise'|'ask'; instruction:string; model?:string; requestId:string; versionId?:string}

export function templateDraft(w:TemplateWorkspace,progress:TemplateProgress,newProduct=false){
 const values={...(progress.baseValues??w.values)},done=new Set<string>()
 for(const [index,batch] of Object.entries(progress.batches)){
  for(const id of batch.received??(batch.complete!==false?progress.plan[Number(index)]??[]:[]))done.add(id)
  for(const c of batch.changes)values[c.id]=c.after
 }
 const pending=progress.plan.flat().filter(id=>!done.has(id))
 if(progress.newProduct??newProduct)for(const id of pending)values[id]='待补全：此处尚未生成新产品内容。'
 return {values,note:progress.baseNote??w.note,pending,completed:done.size,total:progress.plan.flat().length}
}
