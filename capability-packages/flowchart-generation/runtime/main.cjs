'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validate,render}=require('./renderer.cjs');
const fail=message=>{throw Error(message)};
function parse(raw){let s=String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');try{return JSON.parse(s)}catch{fail('模型未返回有效流程数据，请重试；原图已保留')}}
function patch(previous,operations){
  const d=structuredClone(previous);if(!Array.isArray(operations)||operations.length>100)fail('修改操作格式无效');
  for(const op of operations){const at=d.nodes.findIndex(n=>n.id===op.id);
    if(op.op==='text'){if(at<0)fail('找不到要修改的节点');d.nodes[at].text=op.text}
    else if(op.op==='lane'){if(at<0)fail('找不到要修改的节点');d.nodes[at].lane=op.lane}
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
