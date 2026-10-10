'use strict';
const fs=require('node:fs');
const path=require('node:path');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fail=message=>{throw Error(message)};
function validate(value){
  if(!value||!['standard','snake'].includes(value.style))fail('请指定标准流程图或蛇形流程图');
  if(typeof value.title!=='string'||!value.title.trim()||value.title.length>100)fail('标题需要 1–100 个字符');
  if(!Array.isArray(value.nodes)||value.nodes.length<2||value.nodes.length>60)fail('流程需要 2–60 个节点，较长流程请分图');
  const ids=new Set();
  const nodes=value.nodes.map(n=>{
    if(!n||typeof n.id!=='string'||!/^[a-zA-Z][\w-]{0,39}$/.test(n.id)||ids.has(n.id))fail('节点标识缺失或重复');ids.add(n.id);
    if(typeof n.text!=='string'||!n.text.trim()||n.text.length>180||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(n.text))fail('节点文字为空、过长或含异常字符');
    if(!['start','step','decision','end'].includes(n.type))fail('节点类型无效');
    return{id:n.id,text:n.text,type:n.type};
  });
  if(!Array.isArray(value.edges)||value.edges.length>120)fail('流程连线无效');
  const unique=new Set();const edges=value.edges.map(e=>{
    if(!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)fail('连线引用了不存在的节点或自身');
    const key=e.from+'>'+e.to;if(unique.has(key))fail('流程连线重复');unique.add(key);
    if(e.label!==undefined&&(typeof e.label!=='string'||e.label.length>60))fail('分支条件过长');
    return{from:e.from,to:e.to,...(e.label?{label:e.label}:{})};
  });
  const reached=new Set([nodes[0].id]);for(let i=0;i<nodes.length;i++)for(const e of edges)if(reached.has(e.from))reached.add(e.to);
  if(reached.size!==nodes.length)fail('存在从第一步无法到达的节点，请核对连线');
  for(const n of nodes)if(n.type==='decision'&&(edges.filter(e=>e.from===n.id).length<2||edges.some(e=>e.from===n.id&&!e.label)))fail('判断节点需要至少两条带条件说明的分支');
  if(value.style==='snake'&&(nodes.some(n=>n.type==='decision')||edges.length!==nodes.length-1||edges.some((e,i)=>e.from!==nodes[i].id||e.to!==nodes[i+1].id)))fail('蛇形模板只支持按顺序执行的流程。当前包含分支、回路或顺序不一致，请保留标准图，或先确认如何拆分；原图未改变。');
  return{schema:1,title:value.title,style:value.style,nodes,edges};
}
function lines(text,limit=17){const result=[];let line='',width=0;for(const c of text){const w=/[\u0000-\u007f]/.test(c)?.55:1;if(c==='\n'||width+w>limit){result.push(line);line='';width=0;if(c==='\n')continue}line+=c;width+=w}if(line)result.push(line);return result;}
function textBlock(text,x,y,{size=17,color='#19354b',limit=17,weight=500}={}){const a=lines(text,limit),dy=size*1.5;return `<text x="${x}" y="${y-(a.length-1)*dy/2}" text-anchor="middle" dominant-baseline="central" font-size="${size}" font-weight="${weight}" fill="${color}">${a.map((s,i)=>`<tspan x="${x}" dy="${i?dy:0}">${escape(s)}</tspan>`).join('')}</text>`;}
function render(document){
  const d=validate(document),snake=d.style==='snake',palette=['#117c94','#437bc2','#7361b1','#c18524','#35916d'];
  const header=120+(lines(d.title,24).length-1)*38; const cells=new Map(),index=new Map(d.nodes.map((n,i)=>[n.id,i]));let width,height;
  if(snake){const rows=Math.ceil(d.nodes.length/3),rowHeight=Math.max(210,...d.nodes.map(n=>lines(n.text,14).length*26+105));width=1120;height=header+40+rows*rowHeight;d.nodes.forEach((n,i)=>{const r=Math.floor(i/3),c=r%2?2-i%3:i%3;cells.set(n.id,{x:220+c*340,y:header+45+r*rowHeight,w:264,h:Math.max(92,lines(n.text,14).length*26+28),rank:r})})}
  else{
    // Forward edges determine ranks; returns route around the outside without changing semantics.
    const ranks=d.nodes.map(()=>0);for(let i=0;i<d.nodes.length;i++)for(const e of d.edges){const a=index.get(e.from),b=index.get(e.to);if(b===i&&a<b)ranks[b]=Math.max(ranks[b],ranks[a]+1)}
    const rows=new Map();d.nodes.forEach((n,i)=>{const r=ranks[i];if(!rows.has(r))rows.set(r,[]);rows.get(r).push(n)});
    const maxColumns=Math.max(...[...rows.values()].map(r=>r.length));width=Math.max(760,maxColumns*350+400);let y=header;
    for(const [rank,row]of [...rows].sort((a,b)=>a[0]-b[0])){const heights=row.map(n=>Math.max(n.type==='decision'?140:76,lines(n.text,n.type==='decision'?11:17).length*26+(n.type==='decision'?80:30))),rh=Math.max(...heights);row.forEach((n,i)=>cells.set(n.id,{x:width/2+(i-(row.length-1)/2)*350,y:y+rh/2,w:n.type==='decision'?290:286,h:heights[i],rank}));y+=rh+100}height=y+30;
  }
  let body=`<rect width="100%" height="100%" fill="#ffffff"/>${textBlock(d.title,width/2,44+(lines(d.title,24).length-1)*19,{size:25,limit:24,weight:700})}`;
  const edges=[];
  for(let i=0;i<d.edges.length;i++){
    const e=d.edges[i],a=cells.get(e.from),b=cells.get(e.to);let p,labelX,labelY;
    if(snake){if(a.rank===b.rank){const sign=b.x>a.x?1:-1;p=`M ${a.x+sign*a.w/2} ${a.y} H ${b.x-sign*b.w/2}`}else{const side=a.rank%2?-1:1,gutter=a.x+side*(a.w/2+55);p=`M ${a.x+side*a.w/2} ${a.y} H ${gutter} Q ${gutter+side*25} ${a.y} ${gutter+side*25} ${a.y+25} V ${b.y-25} Q ${gutter+side*25} ${b.y} ${gutter} ${b.y} H ${b.x+side*b.w/2}`}edges.push(`<path d="${p}" stroke="${palette[a.rank%palette.length]}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#wide)"/>`);continue}
    if(b.rank>a.rank&&b.rank===a.rank+1){const ay=a.y+a.h/2,by=b.y-b.h/2,mid=(ay+by)/2;p=`M ${a.x} ${ay} V ${mid} H ${b.x} V ${by}`;labelX=(a.x+b.x)/2;labelY=mid-15}
    else{const right=a.x>width/2,sign=right?1:-1,lane=right?width-55-(i%4)*12:55+(i%4)*12; p=`M ${a.x+sign*a.w/2} ${a.y} H ${lane} V ${b.y} H ${b.x+sign*b.w/2}`;labelX=right?width-100:100;labelY=(a.y+b.y)/2}
    edges.push(`<path d="${p}" stroke="#5e7287" stroke-width="2.5" fill="none" stroke-linejoin="round" marker-end="url(#arrow)"/>`);
    if(e.label)edges.push(`<rect x="${labelX-70}" y="${labelY-17}" width="140" height="${lines(e.label,8).length*21+8}" rx="5" fill="white"/>${textBlock(e.label,labelX,labelY,{size:14,limit:8})}`);
  }
  body+=edges.join('');
  d.nodes.forEach((n,i)=>{const c=cells.get(n.id),end=n.type==='start'||n.type==='end',color=snake?palette[c.rank%palette.length]:end?'#b64f59':n.type==='decision'?'#b9842a':'#327ba0',fill=snake?'#f7fafc':end?'#fff0f1':n.type==='decision'?'#fff6df':'#edf7fc';
    body+=n.type==='decision'?`<path d="M ${c.x} ${c.y-c.h/2} L ${c.x+c.w/2} ${c.y} L ${c.x} ${c.y+c.h/2} L ${c.x-c.w/2} ${c.y} Z" fill="${fill}" stroke="${color}" stroke-width="2"/>`:`<rect x="${c.x-c.w/2}" y="${c.y-c.h/2}" width="${c.w}" height="${c.h}" rx="${end?Math.min(c.h/2,32):snake?13:5}" fill="${fill}" stroke="${color}" stroke-width="2"/>`;
    if(snake)body+=`<circle cx="${c.x-c.w/2+5}" cy="${c.y-c.h/2+4}" r="19" fill="${color}"/>${textBlock(String(i+1),c.x-c.w/2+5,c.y-c.h/2+4,{size:16,color:'white',weight:700})}`;
    body+=textBlock(n.text,c.x,c.y,{limit:n.type==='decision'?11:snake?14:17});
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(d.title)}" font-family="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"><title>${escape(d.title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#5e7287"/></marker><marker id="wide" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="2" markerHeight="2" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#5e7287"/></marker></defs>${body}</svg>`;
}
function parse(raw){let s=String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');try{return JSON.parse(s)}catch{fail('模型未返回有效流程数据，请重试；原图已保留')}}
function patch(previous,operations){
  const d=structuredClone(previous);if(!Array.isArray(operations)||operations.length>100)fail('修改操作格式无效');
  for(const op of operations){const at=d.nodes.findIndex(n=>n.id===op.id);
    if(op.op==='text'){if(at<0)fail('找不到要修改的节点');d.nodes[at].text=op.text}
    else if(op.op==='title')d.title=op.title;
    else if(op.op==='type'){if(at<0)fail('找不到要修改的节点');d.nodes[at].type=op.type}
    else if(op.op==='insertAfter'){if(at<0)fail('找不到插入位置');d.nodes.splice(at+1,0,op.node);const following=d.edges.filter(e=>e.from===op.id);if(following.length!==1)fail('分支处插入步骤需明确修改连线');d.edges=d.edges.filter(e=>e!==following[0]);d.edges.push({from:op.id,to:op.node.id},{...following[0],from:op.node.id})}
    else if(op.op==='remove'){if(at<0)fail('找不到要删除的节点');d.nodes.splice(at,1);d.edges=d.edges.filter(e=>e.from!==op.id&&e.to!==op.id)}
    else if(op.op==='edges'){if(!Array.isArray(op.edges))fail('连线格式无效');d.edges=op.edges}
    else if(op.op==='order'){if(!Array.isArray(op.ids)||op.ids.length!==d.nodes.length||new Set(op.ids).size!==d.nodes.length)fail('节点顺序不完整');d.nodes=op.ids.map(id=>d.nodes.find(n=>n.id===id));if(d.nodes.some(n=>!n))fail('节点顺序引用不存在的节点')}
    else fail('未知修改操作');
  }
  if(d.style==='snake')d.edges.sort((a,b)=>d.nodes.findIndex(n=>n.id===a.from)-d.nodes.findIndex(n=>n.id===b.from));
  return validate(d);
}
exports.execute=async({action,input,api})=>{
  if(action!=='diagram')fail('不支持的动作');if(!input||typeof input!=='object')fail('请输入流程内容');
  const mode=input.mode??'create',previous=api.previous?.output?.document;let document;
  if(mode==='read'){if(!previous)fail('当前会话尚无流程图');return{kind:'flowchart',document:previous,svg:render(previous)}}
  if(mode==='restyle'){if(!previous)fail('当前会话尚无流程图');document=validate({...previous,style:input.style??previous.style})}
  else if(mode==='create'||mode==='edit'){
    if(mode==='edit'&&!previous)fail('当前会话尚无流程图，请先生成');
    const content=mode==='create'?input.content:input.instruction;if(typeof content!=='string'||!content.trim()||content.length>16000)fail('请提供明确的流程内容或修改要求（最多 16000 字符）');
    const prompt=fs.readFileSync(path.join(api.resourceRoot,mode==='create'?'create.txt':'edit.txt'),'utf8')+'\n'+JSON.stringify(mode==='create'?{style:input.style,content}:{document:previous,instruction:content});
    const result=parse(await api.model(prompt));if(result.clarification)fail('需要确认：'+result.clarification+'；原图保持不变');
    document=mode==='create'?validate({...result,style:input.style}):patch(previous,result.operations);
  }else fail('不支持的流程图操作');
  return{kind:'flowchart',document,svg:render(document)};
};
exports.validate=validate;exports.render=render;exports.patch=patch;
