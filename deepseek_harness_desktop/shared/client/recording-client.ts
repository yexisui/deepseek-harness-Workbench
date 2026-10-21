/** Shared by the pet and conversation bundles; capture survives component unmounts. */
export type RecordingRow = {followup?:{jobId:string;operation:string;roleVersion:number;capabilityId:string;capabilityVersion:number};id:string;roleId:string;roleVersion:number;roleName:string;title:string;createdAt:string;updatedAt:string;status:'recording'|'paused'|'finished'|'interrupted'|'cancelled';durationMs:number;nextChunk:number;audio?:string;warning?:string;notes:{text:string;at:string}[]}
export type RecordingConfig = {roleId:string;roles:{id:string;name:string}[];ready:boolean}
export async function recordingApi<T>(path:string,body?:unknown):Promise<T>{const r=await fetch('/api/capabilities/recording/'+path,{credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error||'录音保存失败');return value}
type Snapshot={config?:RecordingConfig;rows:RecordingRow[];activeId:string|null;busy:boolean;error:string;elapsed:number;pending:number}
export function createRecorder(){
  let state:Snapshot={rows:[],activeId:null,busy:false,error:'',elapsed:0,pending:0},recorder:MediaRecorder|undefined,stream:MediaStream|undefined,started=0,elapsed=0,queue:{seq:number;blob:Blob}[]=[],sequence=0,upload:Promise<void>|undefined,stopping=false
  const listeners=new Set<()=>void>()
  const emit=(patch:Partial<Snapshot>)=>{state={...state,...patch};listeners.forEach(fn=>fn())}
  const upsert=(row:RecordingRow)=>emit({rows:[row,...state.rows.filter(r=>r.id!==row.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))})
  const current=()=>state.rows.find(r=>r.id===state.activeId)
  const duration=()=>elapsed+(recorder?.state==='recording'?Date.now()-started:0)
  const flush=():Promise<void>=>{
    if(upload)return upload
    upload=(async()=>{while(queue.length){const item=queue[0]!,r=await fetch(`/api/capabilities/recording/chunk?id=${state.activeId}&seq=${item.seq}`,{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream'},body:item.blob});if(!r.ok){const e=await r.json();throw Error(e.error||'保存失败')};queue.shift();emit({pending:queue.length})}})().finally(()=>{upload=undefined});return upload
  }
  const release=()=>{stream?.getTracks().forEach(t=>t.stop());stream=undefined;recorder=undefined}
  const stop=async()=>{if(!recorder||recorder.state==='inactive')return;elapsed=duration();stopping=true;await new Promise<void>(ok=>{recorder!.addEventListener('stop',()=>ok(),{once:true});recorder!.stop()});release();stopping=false}
  const run=async(action:string)=>{
    if(state.busy)return;emit({busy:true,error:''})
    try{
      if(action==='start'){
        if(state.activeId){window.dispatchEvent(new CustomEvent('workbench-recording-open',{detail:state.activeId}));return}
        const config=await recordingApi<RecordingConfig>('config');if(!config.ready)throw Error('请先在能力中心的录音设置中选择归属岗位')
        if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('当前窗口不支持麦克风录音，请使用桌面端或本机浏览器')
        stream=await navigator.mediaDevices.getUserMedia({audio:true})
        const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime){release();throw Error('当前窗口不支持录音格式')}
        recorder=new MediaRecorder(stream,{mimeType:mime})
        const id=crypto.randomUUID();let row:RecordingRow
        try{row=await recordingApi<RecordingRow>('start',{id,mime})}catch(e){release();throw e}
        queue=[];sequence=0;elapsed=0;started=Date.now();upsert(row);emit({activeId:id,elapsed:0})
        recorder.ondataavailable=e=>{if(!e.data.size)return;queue.push({seq:sequence++,blob:e.data});emit({pending:queue.length});void flush().catch(e=>{if(recorder?.state==='recording'){elapsed=duration();recorder.pause()}emit({error:'保存暂时失败，录音已暂停。已收到的片段保留在当前窗口，请重试完成或继续录音。'+e.message})})}
        recorder.onerror=()=>{void run('interrupt')}
        stream.getAudioTracks().forEach(track=>track.onended=()=>{if(!stopping)void run('interrupt')})
        try{recorder.start(3000)}catch(e){release();await recordingApi('command',{id,action:'cancel'});emit({activeId:null,rows:state.rows.filter(r=>r.id!==id)});throw e}
        window.dispatchEvent(new CustomEvent('workbench-recording-open',{detail:id}))
      }else{
        const row=current();if(!row)throw Error('当前没有正在录制的录音')
        if(action==='pause'){if(recorder?.state==='recording'){elapsed=duration();recorder.pause();recorder.requestData();emit({elapsed})}await flush();upsert(await recordingApi('command',{id:row.id,action,durationMs:elapsed}))}
        else if(action==='resume'){await flush();if(recorder?.state!=='paused')throw Error('录音已停止，请完成保存后重新开始');upsert(await recordingApi('command',{id:row.id,action,durationMs:elapsed}));started=Date.now();recorder.resume()}
        else if(['finish','interrupt','cancel'].includes(action)){
          await stop();if(action!=='cancel')await flush();else if(upload)await upload.catch(()=>{})
          const result=await recordingApi<RecordingRow|{deleted:string}>('command',{id:row.id,action,durationMs:elapsed})
          if('deleted'in result){emit({rows:state.rows.filter(r=>r.id!==result.deleted)});window.dispatchEvent(new CustomEvent('workbench-recording-removed',{detail:result.deleted}))}else upsert(result)
          emit({activeId:null,pending:0,elapsed:0});queue=[]
        }
      }
    }catch(e){if(action==='start'&&!state.activeId)release();emit({error:e instanceof Error?e.message:String(e)})}finally{emit({busy:false})}
  }
  setInterval(()=>{
    if(!state.activeId)return
    emit({elapsed:duration()})
  },1000)
  setInterval(()=>{const row=current();if(row&&!state.busy)void recordingApi<RecordingRow>('command',{id:row.id,action:'heartbeat',durationMs:duration()}).then(upsert).catch(e=>emit({error:e.message}))},10000)
  window.addEventListener('beforeunload',e=>{if(state.activeId){e.preventDefault();e.returnValue=''}})
  const refreshConfig=async()=>{try{emit({config:await recordingApi<RecordingConfig>('config')})}catch{emit({config:{roleId:'',roles:[],ready:false}})}}
  const refresh=async()=>{try{emit({rows:await recordingApi<RecordingRow[]>('list')})}catch(e){emit({error:e instanceof Error?e.message:String(e)})}}
  return {getSnapshot:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f)}},run,refresh,refreshConfig,upsert,
    async command(id:string,action:string,value:Record<string,unknown>={}){const row=await recordingApi<RecordingRow|{deleted:string}>('command',{id,action,...value});if('deleted'in row)emit({rows:state.rows.filter(r=>r.id!==id)});else upsert(row)},
  }
}
declare global{interface Window{workbenchRecorder?:ReturnType<typeof createRecorder>}}
export const recordingClient=()=>window.workbenchRecorder??=createRecorder()
const commands:Record<string,string>={'开始录音':'start','暂停录音':'pause','继续录音':'resume','完成录音':'finish','取消录音':'cancel'}
export function recordingCommand(text:string){const action=commands[text.trim().replace(/[。！!]+$/,'')];if(!action)return false;void recordingClient().run(action);return true}
export const recordingTime=(ms:number)=>`${Math.floor(ms/60000).toString().padStart(2,'0')}:${Math.floor(ms/1000%60).toString().padStart(2,'0')}`
