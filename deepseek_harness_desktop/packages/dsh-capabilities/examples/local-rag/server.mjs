// Dependency-free, lexical TF-IDF vector retrieval demo. This is not a neural embedding model.
import {readFile, writeFile, mkdir} from 'node:fs/promises'
import {resolve, relative, isAbsolute, join} from 'node:path'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {pathToFileURL} from 'node:url'

const hash = text => createHash('sha256').update(text).digest('hex')
export function tokens(text) {
  const result = []
  for (const word of text.toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? []) {
    if (/^[a-z0-9]/.test(word)) result.push(word)
    else for (const size of [2,3]) for (let i=0;i<=word.length-size;i++) result.push(word.slice(i,i+size))
  }
  return result
}
function vector(text,idf) {
  const counts = new Map();for(const t of tokens(text)) if(idf[t]) counts.set(t,(counts.get(t)||0)+1)
  const v=Object.fromEntries([...counts].map(([t,n])=>[t,(1+Math.log(n))*idf[t]])),norm=Math.sqrt(Object.values(v).reduce((s,x)=>s+x*x,0))||1
  for(const t of Object.keys(v))v[t]/=norm;return v
}
export async function buildIndex(root) {
  root=resolve(root)
  const manifest=JSON.parse(await readFile(join(root,'资料目录.json'),'utf8')),chunks=[]
  for(const doc of manifest.documents) {
    const file=resolve(root,doc.file),rel=relative(root,file)
    if(rel.startsWith('..')||isAbsolute(rel))throw Error('文档必须在知识库目录内')
    const lines=(await readFile(file,'utf8')).split(/\r?\n/);let heading=doc.title,section=[],start=1
    const flush=()=>{const text=section.join('\n').trim();if(text)chunks.push({...doc,text,title:doc.title,locator:`${doc.file} · ${heading} · 第${start}行`,documentId:doc.id,chunkId:hash(doc.id+':'+start+':'+text).slice(0,20),hash:hash(text)});section=[]}
    for(let i=0;i<lines.length;i++) {
      const line=lines[i]
      if(/^#{1,6}\s/.test(line)){flush();heading=line.replace(/^#+\s*/,'');start=i+1}
      if(section.join('\n').length+line.length>900){flush();start=i+1}
      if(!section.length)start=i+1;section.push(line)
    }
    flush()
  }
  const df={};for(const chunk of chunks)for(const t of new Set(tokens(chunk.title+' '+chunk.text)))df[t]=(df[t]||0)+1
  const idf=Object.fromEntries(Object.entries(df).map(([t,n])=>[t,Math.log((1+chunks.length)/(1+n))+1]))
  const index={algorithm:'TF-IDF 汉字2/3-gram + cosine（词面向量，非神经语义模型）',builtAt:new Date().toISOString(),collections:manifest.collections,idf,chunks:chunks.map(c=>({...c,vector:vector(c.title+' '+c.text,idf)}))}
  await mkdir(join(root,'索引'),{recursive:true});await writeFile(join(root,'索引','向量索引.json'),JSON.stringify(index),'utf8')
  return index
}
export function search(index,body) {
  if(typeof body.query!=='string'||!body.query.trim()||body.query.length>20000)throw Error('检索问题无效')
  const scope=body.scope,allowed=scope?.collectionIds
  if(!Array.isArray(allowed)||!allowed.length||allowed.some(id=>!index.collections.some(c=>c.id===id)))throw Error('请选择有效资料集')
  const q=vector(body.query,index.idf),limit=Math.max(1,Math.min(8,Number(body.limit)||5))
  return {sources:index.chunks.filter(c=>allowed.includes(c.collectionId)&&(!scope.product||c.product===scope.product)&&(!scope.project||c.project===scope.project)).map(c=>({c,score:Object.entries(q).reduce((sum,[t,n])=>sum+n*(c.vector[t]||0),0)})).filter(x=>x.score>=0.07).sort((a,b)=>b.score-a.score).slice(0,limit).map(({c})=>({id:c.chunkId,title:c.title,text:c.text,documentId:c.documentId,chunkId:c.chunkId,collectionId:c.collectionId,locator:c.locator,version:c.version}))}
}
export async function start(root,port=18766) {
  const index=await buildIndex(root)
  const server=createServer(async(req,res)=>{
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body))}
    // Bind to loopback and reject browser-origin requests. The workbench host calls this service.
    if(req.headers.origin)return send(403,{error:'请通过工作台服务端访问'})
    if(req.url==='/v1/status'&&req.method==='GET')return send(200,{protocol:'workbench-knowledge-v1',collections:index.collections,algorithm:index.algorithm,chunks:index.chunks.length,builtAt:index.builtAt})
    if(req.url==='/v1/search'&&req.method==='POST'){
      try {let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>100000)return send(413,{error:'请求过大'});parts.push(part)}return send(200,search(index,JSON.parse(Buffer.concat(parts).toString('utf8'))))}catch{return send(400,{error:'检索参数无效，请检查问题与资料集范围'})}
    }
    return send(404,{error:'接口不存在'})
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)})
  return {server,index,url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const root=resolve(process.argv[2]||'.'),port=Number(process.argv[3]||18766)
  const service=await start(root,port)
  await writeFile(join(root,'索引','服务状态.json'),JSON.stringify({pid:process.pid,url:service.url,startedAt:new Date().toISOString(),chunks:service.index.chunks.length},null,2))
  console.log(`知识库已启动：${service.url}，${service.index.chunks.length} 个片段；修改资料后重启重建索引。`)
}
