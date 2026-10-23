import { forkIdentity, existingFork, writeFork, copyForkDirectory } from './conversation-fork.ts'
import { mkdir, readFile, writeFile, rename, open, readdir, rm, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { latest, type State } from '../core/model.ts'
import { allowedActions } from '../core/policy.ts'
import { InputError } from '../core/validation.ts'
import { json, readBody } from './http.ts'

export type Recording = { followup?: {jobId:string;operation:string;roleVersion:number;capabilityId:string;capabilityVersion:number}; id: string; roleId: string; roleVersion: number; roleName: string; title: string; createdAt: string; updatedAt: string; status: 'recording'|'paused'|'finished'|'interrupted'|'cancelled'; durationMs: number; nextChunk: number; mime: string; audio?: string; warning?: string; notes: {text:string;at:string}[] }
const live = (r: Recording) => r.status === 'recording' || r.status === 'paused'
export class RecordingService {
  private rows = new Map<string, Recording>()
  private tail: Promise<unknown> = Promise.resolve()
  private roleId = ''
  private beats = new Map<string, number>()
  constructor(readonly root: string, private state: () => State, private toolsRoot: string) {}
  private serial<T>(run: () => Promise<T>) { const next = this.tail.then(run); this.tail = next.catch(() => {}); return next }
  private directory(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new InputError('录音标识无效'); return join(this.root, id) }
  private async save(row: Recording) { const directory = this.directory(row.id); await mkdir(directory,{recursive:true}); const f=await open(join(directory,'record.json.tmp'),'w'); try { await f.writeFile(JSON.stringify(row)); await f.sync() } finally { await f.close() }; await rename(join(directory,'record.json.tmp'),join(directory,'record.json')); this.rows.set(row.id,row) }
  async fork(id:string,target:string,forkMeeting:(source:string,target:string)=>Promise<{id:string}>,rollbackMeeting?:(id:string)=>Promise<unknown>){return this.serial(async()=>{
    const row=forkIdentity(this.get(id),target),file=join(this.directory(target),'record.json'),existing=await existingFork<Recording>(file,id);if(existing)return existing
    const wasLive=live(row);if(wasLive)row.status='interrupted'
    const directory=this.directory(target),staging=directory+'.fork'
    try{await copyForkDirectory(this.directory(id),staging);await rm(join(staging,'record.json'),{force:true});if(wasLive&&row.nextChunk){const chunks=[];for(let i=0;i<row.nextChunk;i++)chunks.push(await readFile(join(staging,'chunk-'+i)));row.audio=row.mime.includes('webm')?'recording.webm':'recording.mp4';await writeFile(join(staging,row.audio),Buffer.concat(chunks))}if(row.followup){const job=await forkMeeting(row.followup.jobId,target);row.followup={...row.followup,jobId:job.id}}await writeFork(join(staging,'record.json'),row);await rename(staging,directory);this.rows.set(target,row)}catch(e){await rm(staging,{recursive:true,force:true});if(row.followup?.jobId===target)await rollbackMeeting?.(target);throw e}return row
  })}

  async init() {
    await mkdir(this.root,{recursive:true})
    try { this.roleId=JSON.parse(await readFile(join(this.root,'settings.json'),'utf8')).roleId || '' } catch(e) { if ((e as NodeJS.ErrnoException).code!=='ENOENT') throw e }
    for (const entry of await readdir(this.root,{withFileTypes:true})) {
      if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue
      const row:Recording=JSON.parse(await readFile(join(this.directory(entry.name),'record.json'),'utf8'))
      this.rows.set(row.id,row)
      if (live(row)) {
        while (await stat(join(this.directory(row.id),`chunk-${row.nextChunk}`)).then(()=>true,()=>false)) row.nextChunk++
        row.status='interrupted'; row.warning='录音意外中断，已保留成功保存的部分。'; await this.finalize(row) }
    }
  }
  async linkFollowup(id:string,link:NonNullable<Recording['followup']>){return this.serial(async()=>{const row=this.get(id);row.followup=link;await this.save(row);return row})}
  audioFile(id:string){const row=this.get(id);if(!row.audio||live(row))throw new InputError('请先完成并保存录音');return join(this.directory(id),row.audio)}
  config() {
    const state=this.state()
    const roles=state.roles.filter(r=>r.enabled&&!r.removedAt&&!r.archivedAt&&latest(r.versions)&&allowedActions(state,r.id,latest(r.versions)!).includes('record-audio')).map(r=>({id:r.id,name:latest(r.versions)!.name}))
    const roleId=this.roleId || (roles.length===1?roles[0]!.id:'')
    return {roleId,roles,ready:roles.some(r=>r.id===roleId)}
  }
  activities() { return [...this.rows.values()].filter(live).map(r=>({id:r.id,roleId:r.roleId,roleVersion:r.roleVersion,name:r.title,status:r.status,kind:'recording',componentIds:['audio-recorder']})) }
  list() { return [...this.rows.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) }
  get(id:string) { this.directory(id); const row=this.rows.get(id); if(!row)throw new InputError('录音不存在',404);return row }
  async configure(roleId:string) { return this.serial(async()=>{ if(!this.config().roles.some(r=>r.id===roleId))throw new InputError('请选择已绑定录音能力的启用岗位'); await writeFile(join(this.root,'settings.json.tmp'),JSON.stringify({roleId}));await rename(join(this.root,'settings.json.tmp'),join(this.root,'settings.json'));this.roleId=roleId;return this.config() }) }
  async start(id:string,mime:string) { return this.serial(async()=>{
    this.directory(id); const previous=this.rows.get(id); if(previous)return previous
    // An absent page cannot keep the microphone alive. Recover its last saved chunks.
    for(const r of this.rows.values())if(live(r)&&Date.now()-(this.beats.get(r.id)??0)>30000){r.status='interrupted';r.warning='录音连接中断，已保留成功保存的部分。';await this.finalize(r)}
    if([...this.rows.values()].some(live))throw new InputError('已有录音进行中，请先完成或取消',409)
    const config=this.config();if(!config.ready)throw new InputError('请在录音能力设置中选择录音归属岗位')
    if(!['audio/webm;codecs=opus','audio/webm','audio/mp4'].includes(mime))throw new InputError('当前录音格式不受支持')
    if(!this.roleId){await writeFile(join(this.root,'settings.json.tmp'),JSON.stringify({roleId:config.roleId}));await rename(join(this.root,'settings.json.tmp'),join(this.root,'settings.json'));this.roleId=config.roleId}
    const role=this.state().roles.find(r=>r.id===config.roleId)!, version=latest(role.versions)!, now=new Date().toISOString()
    const row:Recording={id,roleId:role.id,roleVersion:version.version,roleName:version.name,title:'录音 · '+new Date().toLocaleString('zh-CN',{hour12:false}),createdAt:now,updatedAt:now,status:'recording',durationMs:0,nextChunk:0,mime,notes:[]}
    await this.save(row);this.beats.set(id,Date.now());return row
  }) }
  async chunk(id:string,seq:number,req:AsyncIterable<Uint8Array>) { return this.serial(async()=>{
    const row=this.get(id);if(!live(row))throw new InputError('录音已结束',409)
    if(!Number.isSafeInteger(seq)||seq<0||seq>row.nextChunk)throw new InputError('录音片段顺序不正确',409)
    const buffers:Buffer[]=[];let size=0;for await(const piece of req){size+=piece.length;if(size>32*1024*1024)throw new InputError('录音片段过大',413);buffers.push(Buffer.from(piece))}
    if(seq<row.nextChunk)return row // Retrying an acknowledged chunk must not duplicate audio.
    const directory=this.directory(id), path=join(directory,`chunk-${seq}`), handle=await open(path+'.tmp','w')
    try{await handle.writeFile(Buffer.concat(buffers));await handle.sync()}finally{await handle.close()}
    await rename(path+'.tmp',path);row.nextChunk++;this.beats.set(id,Date.now());await this.save(row);return row
  }) }
  async command(id:string,body:Record<string,unknown>) { return this.serial(async()=>{
    const row=this.get(id), action=body.action
    if(action==='rename'){if(typeof body.title!=='string'||!body.title.trim())throw new InputError('请输入名称');row.title=body.title.trim().slice(0,120)}
    else if(action==='note'){if(typeof body.text!=='string'||!body.text.trim())throw new InputError('请输入内容');row.notes.push({text:body.text.trim().slice(0,20000),at:new Date().toISOString()})}
    else if(action==='delete'){if(live(row))throw new InputError('请先完成或取消录音');await rm(this.directory(id),{recursive:true,force:true});this.rows.delete(id);return {deleted:id}}
    else if(action==='cancel') { row.status='cancelled';await rm(this.directory(id),{recursive:true,force:true});this.rows.delete(id);if(!row.notes.length)return {deleted:id};row.nextChunk=0;row.audio=undefined;row.warning=undefined }
    else if(action==='recover'){if(live(row)&&Date.now()-(this.beats.get(id)??0)<30000)throw new InputError('录音仍在其他窗口进行中');row.status='interrupted';await this.finalize(row);return row}
    else {
      if(!live(row)) {if(action==='finish')return row;throw new InputError('录音已结束',409)}
      if(typeof body.durationMs==='number'&&Number.isFinite(body.durationMs))row.durationMs=Math.max(row.durationMs,body.durationMs)
      this.beats.set(id,Date.now())
      if(action==='pause')row.status='paused'
      else if(action==='resume')row.status='recording'
      else if(action==='finish'||action==='interrupt'){row.status=action==='finish'?'finished':'interrupted';await this.finalize(row);return row}
      else if(action!=='heartbeat')throw new InputError('未知录音操作')
    }
    row.updatedAt=new Date().toISOString();await this.save(row);return row
  }) }
  private async finalize(row:Recording) {
    const dir=this.directory(row.id), raw=row.mime.startsWith('audio/mp4')?'capture.mp4':'capture.webm'
    if(row.nextChunk){
      const out=await open(join(dir,raw),'w');try{for(let i=0;i<row.nextChunk;i++)await out.writeFile(await readFile(join(dir,`chunk-${i}`)));await out.sync()}finally{await out.close()}
      row.audio=raw
      try {
        const root=join(this.toolsRoot,'ffmpeg'), pointer=JSON.parse((await readFile(join(root,'current.json'),'utf8')).replace(/^\uFEFF/,'')), ffmpeg=resolve(root,pointer.ffmpeg), rel=relative(root,ffmpeg)
        if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('工具路径无效')
        await new Promise<void>((ok,no)=>execFile(ffmpeg,['-y','-nostdin','-v','error','-i',join(dir,raw),'-vn','-c:a','aac','-movflags','+faststart',join(dir,'recording.m4a')],{windowsHide:true,timeout:120000},e=>e?no(e):ok()))
        row.audio='recording.m4a'
      } catch {row.warning='原始录音已保存；音频整理未完成，回听定位可能受限。'}
    }
    row.updatedAt=new Date().toISOString();await this.save(row)
  }
  async audio(id:string,req:IncomingMessage,res:ServerResponse) {
    const row=this.get(id);if(!row.audio)throw new InputError('尚无已完成的录音文件',404)
    const file=join(this.directory(id),row.audio),{size}=await stat(file),range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
    const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),size-1):size-1
    if(start>end||start>=size){res.writeHead(416,{'content-range':`bytes */${size}`});res.end();return}
    res.writeHead(range?206:200,{'content-type':row.audio.endsWith('.webm')?'audio/webm':'audio/mp4','content-length':end-start+1,'accept-ranges':'bytes','cache-control':'no-store',...(range?{'content-range':`bytes ${start}-${end}/${size}`}:{})})
    createReadStream(file,{start,end}).pipe(res)
  }
}
export async function recordingRoutes(service:RecordingService,req:IncomingMessage,res:ServerResponse) {
  const url=new URL(req.url!,'http://localhost'), path=url.pathname.replace('/api/capabilities/recording/',''), id=url.searchParams.get('id')??''
  if(req.method==='GET'&&path==='config')return json(res,200,service.config())
  if(req.method==='GET'&&path==='list')return json(res,200,service.list())
  if(req.method==='GET'&&path==='audio')return service.audio(id,req,res)
  if(req.method==='PUT'&&path==='chunk')return json(res,200,await service.chunk(id,Number(url.searchParams.get('seq')),req))
  if(req.method!=='POST')throw new InputError('接口不存在',404)
  const body=await readBody(req)
  if(path==='config')return json(res,200,await service.configure(body.roleId))
  if(path==='start')return json(res,201,await service.start(body.id,body.mime))
  if(path==='command')return json(res,200,await service.command(body.id,body))
  throw new InputError('接口不存在',404)
}
