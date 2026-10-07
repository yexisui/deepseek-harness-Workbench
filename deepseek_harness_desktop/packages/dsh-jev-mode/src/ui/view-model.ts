import {candidates,candidateConfig,connectionConfig,type JevConfig,type JevStatus} from '../core/contract.ts'
export const stageName={begin:'任务评估',action:'动作检查',review:'结果复核'}
export const statusName={allowed:'通过',clarify:'待确认',blocked:'已阻止',error:'未完成'}
export const connectionName={unconfigured:'待配置',unverified:'未检查',checking:'检查中',ready:'检查通过',error:'检查异常'}
export const fieldName:Record<keyof JevConfig,string>={enabled:'全局开关',connectionMode:'模型配置',backend:'接入方式',model:'决策模型',reasoningEffort:'思考强度',timeoutMs:'检查超时',maxChecks:'每轮检查次数',maxContextChars:'上下文上限',candidates:'候选模型顺序与开关',totalTimeoutMs:'候选链总超时'}
export function fieldErrors(value:JevConfig){const errors:Partial<Record<keyof JevConfig,string>>={};if(value.model.length>250||/[\r\n]/.test(value.model))errors.model='模型标识不能超过 250 字符或包含换行';for(const [key,min,max,label] of [['timeoutMs',5000,120000,'超时应为 5–120 秒'],['maxChecks',3,32,'检查次数应为 3–32 的整数'],['maxContextChars',4000,64000,'上下文应为 4000–64000 的整数']] as const){if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)errors[key]=label}if(value.totalTimeoutMs!==undefined&&(!Number.isInteger(value.totalTimeoutMs)||value.totalTimeoutMs<5000||value.totalTimeoutMs>300000))errors.totalTimeoutMs='总超时应为 5–300 秒';return errors}
export function modeLabel(data:JevStatus|null){return !data?'正在加载':data.config.value.enabled?(data.state==='unavailable'?'开启 · 需处理':'开启'):'关闭'}
export function scopeLabel(scope:string){return ({native:'聊天会话',developer:'开发任务',requirements:'需求分析',meeting:'会议纪要',diagnostic:'模型诊断'} as Record<string,string>)[scope.split(':')[0]!]??'历史任务'}
type Conversation={name:string;open?:()=>void}
let resolveConversation:(scope:string)=>Conversation|undefined=()=>undefined
export function registerJevNavigation(resolve:typeof resolveConversation){resolveConversation=resolve;return()=>{if(resolveConversation===resolve)resolveConversation=()=>undefined}}
export function conversation(scope:string):Conversation{return resolveConversation(scope)??{name:scopeLabel(scope)+'（未加载或已移除）'}}
export type TraceFilters={query:string;stage:string;status:string;days:string}
export const emptyFilters:TraceFilters={query:'',stage:'',status:'',days:''}

export function modelSummary(value:JevConfig){const rows=candidates(value);return rows.length?'候选 '+rows.length+' 项 · 开启 '+rows.filter(c=>c.enabled).length+' 项':'尚未添加候选模型'}
export function fieldValue(value:unknown){return Array.isArray(value)?value.map(c=>c.model+'（'+(c.enabled?'开':'关')+'）').join('；')||'空列表':String(value??'默认')}
export const sameField=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)

export function diagnosticMatches(checked:JevConfig,current:JevConfig){return candidates(checked).filter(c=>c.enabled).every(c=>candidates(current).some(r=>connectionConfig(candidateConfig(checked,c))===connectionConfig(candidateConfig(current,r))))}
