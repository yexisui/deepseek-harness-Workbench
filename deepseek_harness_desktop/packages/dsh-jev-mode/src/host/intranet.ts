import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { JevError } from '../core/contract.ts'
export function privateAddress(address: string): boolean {
  if(isIP(address)===4){const a=address.split('.').map(Number);return a[0]===10||a[0]===127||(a[0]===172&&a[1]!>=16&&a[1]!<=31)||(a[0]===192&&a[1]===168)}
  const a=address.toLowerCase();return isIP(a)===6&&(a==='::1'||/^f[cd][0-9a-f]{2}:/.test(a)||a.startsWith('::ffff:')&&privateAddress(a.slice(7)))
}
export function endpoint(raw: string): URL {
  let url:URL;try{url=new URL(raw)}catch{throw new JevError('所选账号没有有效的内网模型地址')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new JevError('内网模型地址必须是 HTTP(S)，且不能包含凭据、查询或片段')
  const host=url.hostname.replace(/^\[|\]$/g,'')
  if(isIP(host)&&!privateAddress(host))throw new JevError('JEV 默认后端只允许内网地址；公网模型不能作为决策模型')
  url.pathname=url.pathname.replace(/\/+$/,'')+'/chat/completions';return url
}
/** Pin the validated IP at the actual socket. No redirect, proxy, or public fallback. */
export async function intranetJson(url: URL,body: unknown,key: string,signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const host=url.hostname.replace(/^\[|\]$/g,''),addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true})
  signal.throwIfAborted()
  if(!addresses.length||addresses.some(a=>!privateAddress(a.address)))throw new JevError('JEV 模型域名未完全解析到内网地址，已拒绝请求')
  const target=addresses[0]!,payload=Buffer.from(JSON.stringify(body))
  return new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'POST',agent:false,signal,lookup:((_h:unknown,_o:unknown,done:any)=>done(null,target.address,target.family)) as any,headers:{'content-type':'application/json','content-length':payload.length,'user-agent':'DeepSeek-Harness-JEV/0.1',...(key?{authorization:'Bearer '+key}:{})}},res=>{
      if(res.statusCode!==200){res.resume();reject(new JevError(`内网 JEV 请求失败（HTTP ${res.statusCode}）；没有切换其他服务`));return}
      let size=0;const chunks:Buffer[]=[]
      res.on('data',chunk=>{size+=chunk.length;if(size>256*1024){req.destroy();reject(new JevError('JEV 返回超出限制'))}else chunks.push(chunk)})
      res.on('error',()=>reject(new JevError('内网 JEV 响应中断')))
      res.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),text=data.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw new Error();resolve(text)}catch{reject(new JevError('内网 JEV 响应格式无效'))}})
    })
    req.on('error',()=>reject(new JevError(signal.aborted?'JEV 检查已取消或超时':'内网 JEV 连接失败；请检查模型账号')));req.end(payload)
  })
}
