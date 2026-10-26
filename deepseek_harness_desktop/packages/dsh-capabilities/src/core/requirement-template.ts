/** Optional document workspace on the existing requirements task; old tasks stay intact. */
export type TemplateSlot = { id:string; part:string; index:number; text:string; style:string; heading:boolean; image:boolean; editable:boolean; table?:number; row?:number; cell?:number }
export type TemplateSource = { id:string; name:string; asset?:string; kind:'docx'|'text'; slots:TemplateSlot[]; enabled:boolean }
export type TemplateCitation = { sourceId:string; blockId:string; name:string; quote:string; locator?:string }
export type TemplateChange = { id:string; before:string; after:string; sources?:TemplateCitation[] }
export type TemplateGroup = { id:string; title:string; reason:string; changes:TemplateChange[]; status:'pending'|'accepted'|'rejected'|'reverted' }
export type TemplateProposal = { evidence?:import('./knowledge.ts').KnowledgeEvidence[]; id:string; instruction:string; summary:string; questions:string[]; groups:TemplateGroup[]; createdAt:string }
export type TemplateVersion = { evidenceGroups?:{proposalId:string;groupId:string}[]; id:string; number:number; label:string; at:string; values:Record<string,string>; note:string }
export type TemplateAnswer = { evidence?:import('./knowledge.ts').KnowledgeEvidence[]; id:string; question:string; answer:string; at:string; sources:{sourceId:string; blockId:string; name:string; quote:string}[] }
export type TemplateWorkspace = { knowledge?:import('./knowledge.ts').KnowledgeScope;
  product:string; brief:string; intent:'new-product'|'revise'; template?:TemplateSource; sources:TemplateSource[]
  values:Record<string,string>; note:string; proposals:TemplateProposal[]; versions:TemplateVersion[]; answers:TemplateAnswer[]
}
export const emptyTemplateWorkspace=():TemplateWorkspace=>({product:'',brief:'',intent:'new-product',sources:[],values:{},note:'',proposals:[],versions:[],answers:[]})
export type TemplateCommand =
 | {type:'template.knowledge'; scope?:import('./knowledge.ts').KnowledgeScope}
 | {type:'template.save'; product:string; brief:string; intent:'new-product'|'revise'}
 | {type:'template.source'; id:string; enabled:boolean}
 | {type:'template.review'; proposalId:string; groupIds:string[]; action:'accept'|'reject'|'revert'}
 | {type:'template.edit'; id:string; before:string; after:string}
 | {type:'template.note'; note:string}
 | {type:'template.version'; label?:string}
 | {type:'template.restore'; id:string}
 | {type:'template.run'; action:'generate'|'revise'|'ask'; instruction:string; model?:string; requestId:string}
