import React,{useEffect,useState} from 'react'
import { createRoot } from 'react-dom/client'
import { DocxEditor } from '@docx-editor.dev/react'
import { zhCN } from '@docx-editor.dev/i18n'
import { createFontSource } from '@docx-editor.dev/core/editor'
import '@docx-editor.dev/react/styles.css'
import './frame.css'

const channel=new URLSearchParams(location.search).get('channel')||'validation'
let editor:any, revision=0, fontFailures:string[]=[],lastAI:number|undefined
const send=(type:string,value:any)=>parent.postMessage({source:'workbench-document',channel,type,value},location.origin)
let resolveReady:()=>void
const ready=new Promise<void>(resolve=>{resolveReady=resolve})
async function fonts(){
  const list=await fetch('fonts.json').then(r=>{if(!r.ok)throw Error('本机字体加载失败');return r.json()})
  const sources=await Promise.all(list.map(async(f:any)=>{const response=await fetch(String(f.url));if(!response.ok)throw Error('字体不可用');const bytes=new Uint8Array(await response.arrayBuffer());const result=createFontSource(bytes,{...f.request,faceIndex:f.faceIndex},{id:f.id});if('failure' in result)throw Error(JSON.stringify(result.failure));return result.source}))
  return {epoch:1,maxFontBytes:64*1024*1024,sources,defaultFont:{family:'SimSun',sizeHalfPoints:24},supportedFamilies:sources.map((f:any)=>f.request.family)}
}
function context(){
  const snap=editor.snapshot()
  return {revision,selection:editor.query({type:'selectedText'}),paragraphs:editor.query({type:'paragraphs'}),outline:editor.getOutline(),editable:snap.editable,parseError:snap.parseError,fontFailures}
}
async function call(op:string,args:any={}){
  await ready
  if(op==='load'){
    editor.load(new Uint8Array(args.bytes as ArrayBuffer));revision=0;lastAI=undefined
    await editor.save() // Public save flushes a deferred document open before reads.
    const started=Date.now()
    do{await new Promise(resolve=>setTimeout(resolve,30));const state=editor.snapshot();if(state.parseError)throw Error(String(state.parseError));if(!state.isLoading&&!state.isOpening&&state.editable)return context()}while(Date.now()-started<45000)
    throw Error('文档打开超时，请检查文件是否损坏或包含过多图片')
  }
  if(op==='context')return context()
  if(op==='save')return {bytes:await editor.save(),revision}
  if(op==='find'){if(args.paraId){if(!editor.scrollToAnchor({paraId:args.paraId,search:args.text}))throw Error('引用处已变化，请核对原文');editor.highlightAnchor({paraId:args.paraId,search:args.text});return context()}const matches=editor.findMatches(args.text,{matchCase:true});if(!matches.length)throw Error('原文已变化，未找到对应内容');if(matches[args.index||0])editor.selectMatch(matches[args.index||0]);return {count:matches.length,...context()}}
  if(op==='replace'){
    if(args.revision!==revision)throw Error('文档已变化，请重新生成修改建议')
    if(args.paraId&&!editor.query({type:'paragraphs'}).some((p:any)=>p.paraId===args.paraId&&p.text.includes(args.before)))throw Error('修改目标已变化，请重新生成建议')
    // The current tree editor exposes DocEdits types but refuses replaceText at runtime.
    // Its supported selection/paste contract retains native undo and run formatting.
    const matches=editor.findMatches(args.before,{matchCase:true});if(matches.length!==1)throw Error('修改位置不唯一，请补充可区分的上下文')
    const selected=editor.selectMatch(matches[0]);if(!selected.ok)throw Error(selected.reason)
    const result=editor.exec({type:'pasteWithoutFormatting',text:args.after})
    if(!result.ok)throw Error(result.message||result.reason||'编辑器拒绝修改')
    if(!result.changed)throw Error('未产生文档修改')
    lastAI=revision
    return context()
  }
  if(op==='undo-ai'){if(lastAI===undefined||lastAI!==revision)throw Error('后续已有其他编辑，请使用文档工具栏逐步撤销');const result=editor.exec({type:'undo'});if(!result.ok)throw Error(result.reason);lastAI=undefined;return context()}
  if(op==='undo'){const result=editor.exec({type:'undo'});return {result,...context()}}
  throw Error('不支持的文档操作')
}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.source!=='workbench-document-host'||event.data.channel!==channel)return
  const {id,op,args}=event.data
  try{send('result',{id,ok:true,result:await call(op,args)})}catch(error){send('result',{id,ok:false,error:(error as Error).message})}
})
async function boot(){
 const config=await fonts()
 function Frame(){
  const mode=(): 'light'|'dark'=>getComputedStyle(parent.document.documentElement).colorScheme==='dark'?'dark':'light'
  const [colorMode,setColorMode]=useState(mode)
  useEffect(()=>{const observer=new MutationObserver(()=>setColorMode(mode()));observer.observe(parent.document.documentElement,{attributes:true});observer.observe(parent.document.head,{childList:true,subtree:true,attributes:true});return()=>observer.disconnect()},[])
  return <DocxEditor document="blank" title="" i18n={zhCN} locale="zh-CN" fonts={config} colorMode={colorMode} menu={false} rulers={false} navigation={false} onSave={()=>send('save-request',null)} onReady={value=>{editor=value;editor.on('error',(error:any)=>send('error',error.message));editor.on('selectionChange',()=>send('selection',context()));editor.on('change',()=>{revision++;send('change',{revision})});resolveReady();send('ready',context())}} onFontError={error=>{fontFailures.push(error.message);send('font-error',error.message)}}/>
 }
 createRoot(document.getElementById('root')!).render(<Frame/> )
}
boot().catch(error=>{document.getElementById('root')!.textContent=error.message;send('error',error.message)})
