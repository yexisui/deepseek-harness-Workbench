import { describe, it, expect, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractContent, extractArchivePage } from '../src/host/browser-content.ts'
import { BrowserArchives, publicAddress, downloadResource } from '../src/host/browser-archive.ts'
import { callViolation } from '../src/core/policy.ts'
import { CapabilityRuntime } from '../src/host/runtime.ts'
vi.mock('node:timers/promises',()=>({setTimeout:async(_ms:number,_v:unknown,o:{signal:AbortSignal})=>o.signal.throwIfAborted()}))
const url='https://example.com/article.html',signal=new AbortController().signal
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64')
const html=(n=1)=>`<html><head><title>归档测试</title></head><body><nav>导航<img src="/logo.png"></nav><article><h1>归档测试</h1><p>第${n}页第一段足够长的正文，必须保留前后顺序和完整内容。</p><figure><img src="/thumb.png" data-original="/photo.png" alt="图片描述"><figcaption>原始图注</figcaption></figure><p>配图之后的正文末尾${n}。</p><table><tr><th>项目</th><th>数量</th></tr><tr><td>A</td><td>2</td></tr></table><a href="/report.pdf">报告附件</a></article><aside>相关推荐<img src="/other.png"></aside><div class="pagination"><span class="current">${n}</span><a href="${n===1?'article_1.html':'article.html'}">${n===1?2:1}</a>共2页</div><script>bad()</script></body></html>`
function browser(){let n=1;return vi.fn(async(name:string,args:any)=>name==='browser_page'?(n=args.url.includes('_1')?2:1,{url:args.url}):{html:html(n),truncated:false})}
describe('webpage archive',()=>{
 it('initializes the existing browser connection, waits for readiness, and respects cancellation',async()=>{
  const runtime:any=new CapabilityRuntime({} as never,{} as never,{bskPath:'configured',bskHome:'configured',port:52800})
  runtime.connect=vi.fn(async()=>({state:'unknown'}));runtime.check=vi.fn(async()=>({state:'ready'}))
  await runtime.ensureBrowser(signal);expect(runtime.connect).toHaveBeenCalledOnce();expect(runtime.check).toHaveBeenCalledOnce()
  runtime.connect.mockResolvedValue({state:'missing',message:'missing CLI'});await expect(runtime.ensureBrowser(signal)).rejects.toThrow('missing CLI')
  const abort=new AbortController();abort.abort(Error('cancelled'));runtime.connect.mockClear();await expect(runtime.ensureBrowser(abort.signal)).rejects.toThrow('cancelled');expect(runtime.connect).not.toHaveBeenCalled()
 })
 it('keeps ordered text/images/tables and classifies peripheral resources',()=>{
  const p=extractContent(html(),url)
  expect(p.resources.filter(r=>r.category==='main').map(r=>r.kind)).toEqual(['image','attachment'])
  expect(p.resources.find(r=>r.category==='main')!.url).toBe('https://example.com/photo.png')
  expect(p.resources.find(r=>r.category==='main')!.caption).toBe('原始图注')
  expect(p.blocks.map(b=>b.kind)).toEqual(['heading','text','image','text','text','table','text'])
  expect(p.text).toContain('配图之后');expect(p.text).not.toMatch(/相关推荐|bad\(\)|导航/)
  expect(p.other.some(b=>b.text?.includes('相关推荐'))).toBe(true)
 })
 it('supports general pages but does not bypass an unparsed paginated article',()=>{
  expect(extractArchivePage('<html><head><title>产品页</title></head><body><div>这是一段足够长的产品信息，没有 article 标签也能保留。</div></body></html>',url).body).toContain('产品信息')
  expect(()=>extractArchivePage('<body><div>这是一段足够长的正文信息，没有 article 标签。</div><div class="pagination">1 2</div></body>',url)).toThrow()
 })
 it('captures both pages, verifies image files, deduplicates bytes, saves summary, and persists across reopen',async()=>{
  const root=await mkdtemp(join(tmpdir(),'图文归档 '))
  try{
   const fetcher=vi.fn(async(u:string)=>u.endsWith('.pdf')?{bytes:Buffer.from('%PDF-1.4\nfixture'),mime:'application/pdf'}:{bytes:png,mime:'image/png'})
   const store=new BrowserArchives(root,fetcher),scroll=vi.fn(async()=>{})
   const r=await store.capture({session:'mine',url},'owner',browser(),scroll,signal,4388)
   expect(r.readPages).toBe(2);expect(r.textComplete).toBe(true);expect(r.savedImages).toBe(1);expect(r.imageReferences).toBe(6);expect(r.status).toBe('captured');expect(r.summarySaved).toBe(false)
   expect(fetcher).toHaveBeenCalledTimes(4);expect(scroll).toHaveBeenCalledTimes(2)
   const m=await store.get(r.archiveId,'owner');expect(m.files.some(f=>f.startsWith('表格/'))).toBe(true)
   const image=m.pages[0]!.resources.find(r=>r.kind==='image'&&r.category==='main')!
   expect(await readFile(join(r.folder,image.file!))).toEqual(png)
   const view=await readFile(join(r.folder,'阅读版.html'),'utf8');expect(view).toContain(image.file);expect(view).not.toContain('<script>bad()')
   expect(view.indexOf('第一段')).toBeLessThan(view.indexOf(image.file!));expect(view.indexOf(image.file!)).toBeLessThan(view.indexOf('配图之后'))
   await expect(store.summarize(r.archiveId,'other','bad',4388)).rejects.toThrow('不属于')
   const done=await store.summarize(r.archiveId,'owner','## 分类要点\n第1、2页正文总结。',4388);expect(done.complete).toBe(true)
   const reopened=await new BrowserArchives(root).get(r.archiveId);expect(reopened.summary).toContain('分类要点')
   expect(await readFile(join(r.folder,'内容总结.md'),'utf8')).toContain('第1、2页')
  }finally{await rm(root,{recursive:true,force:true})}
 })
 it('reports failed image validation and download errors, preserving text and good files',async()=>{
  const root=await mkdtemp(join(tmpdir(),'archive-failure-'));try{
   const store=new BrowserArchives(root,async u=>{if(u.endsWith('/photo.png'))return {bytes:Buffer.from('<html>login</html>'),mime:'image/png'};if(u.endsWith('.pdf'))throw Error('HTTP 403');return {bytes:png,mime:'image/png'}})
   const r=await store.capture({session:'mine',url},'owner',browser(),async()=>{},signal,4388)
   expect(r.status).toBe('partial');expect(r.failedResources).toHaveLength(4);expect(r.textComplete).toBe(true)
   expect((await store.summarize(r.archiveId,'owner','有图片下载失败。',4388)).complete).toBe(false)
  }finally{await rm(root,{recursive:true,force:true})}
 })
 it('retains collected page evidence when cancelled before downloads finish',async()=>{
  const root=await mkdtemp(join(tmpdir(),'archive-stop-')),abort=new AbortController();try{
   const store=new BrowserArchives(root,async()=>{abort.abort(Error('user stopped'));throw Error('stopped')})
   await expect(store.capture({session:'mine',url},'owner',browser(),async()=>{},abort.signal,4388)).rejects.toThrow('user stopped')
   const dirs=await readdir(root);const m=JSON.parse(await readFile(join(root,dirs[0]!,'采集清单.json'),'utf8'));expect(m.status).toBe('stopped');expect(m.pages.length).toBe(2)
  }finally{await rm(root,{recursive:true,force:true})}
 })
 it('rejects local/private download destinations and requires browser read/navigation ownership',async()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','::1','fc00::1','::ffff:127.0.0.1'])expect(publicAddress(ip)).toBe(false)
  expect(publicAddress('8.8.8.8')).toBe(true)
  await expect(downloadResource('http://127.0.0.1/a','https://example.com',signal)).rejects.toThrow('公开网络')
  expect(callViolation('browser_archive',{session:'mine',url},['read'],['mine'])).toBeTruthy()
  expect(callViolation('browser_archive',{session:'other',url},['navigate','read'],['mine'])).toBeTruthy()
  expect(callViolation('browser_archive',{session:'mine',url},['navigate','read'],['mine'])).toBeUndefined()
  expect(callViolation('browser_archive_summary',{archiveId:'bad'},['read'],[])).toBeTruthy()
 })
})
