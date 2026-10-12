/** External products implement this host-side contract; credentials stay inside the adapter. */
export type KnowledgeSource={id:string;title:string;text:string;url?:string}
export interface DocumentKnowledgeAdapter {
 status():Promise<{configured:boolean;verified:boolean;label:string;message:string}>
 search(request:{query:string;limit:number},signal:AbortSignal):Promise<{sources:KnowledgeSource[]}>
}
export const noDocumentKnowledge={configured:false,verified:false,label:'外部资料库',message:'接口已预留，暂未接入服务。'} as const
export function knowledgeSources(sources:KnowledgeSource[]):KnowledgeSource[]{
 if(!Array.isArray(sources))throw Error('资料库未返回有效来源列表')
 return sources.slice(0,8).map((source,index)=>{
  if(typeof source.title!=='string'||typeof source.text!=='string')throw Error('资料库来源缺少标题或正文')
  let url:string|undefined
  if(source.url){const value=new URL(source.url);if(!['https:','http:'].includes(value.protocol)||value.username||value.password)throw Error('资料库来源链接无效');url=value.href}
  return {id:'K'+(index+1),title:source.title.slice(0,240),text:source.text.slice(0,6000),...(url?{url}:{})}
 })
}
