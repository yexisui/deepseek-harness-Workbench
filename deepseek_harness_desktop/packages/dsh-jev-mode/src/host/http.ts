import type { IncomingMessage, ServerResponse } from 'node:http'
import { JevError } from '../core/contract.ts'
export function fence(req:IncomingMessage){
  let host:URL;try{host=new URL('http://'+req.headers.host)}catch{throw new JevError('无效 Host',403)}
  if(!['localhost','127.0.0.1','[::1]'].includes(host.hostname))throw new JevError('仅允许本机访问',403)
  if(req.headers.origin){let origin:URL;try{origin=new URL(req.headers.origin)}catch{throw new JevError('无效 Origin',403)};if(origin.origin!==host.origin)throw new JevError('不允许跨站访问',403)}
  if(req.headers['sec-fetch-site']==='cross-site')throw new JevError('不允许跨站访问',403)
  if(req.method==='POST'&&!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new JevError('需要 JSON 请求',415)
}
export async function readBody(req:IncomingMessage){const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>16000)throw new JevError('JEV 请求过大',413);chunks.push(buffer)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new JevError('JSON 格式无效',400)}}
export function json(res:ServerResponse,status:number,value:unknown){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value))}
