const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {validate,render,patch,execute}=require('../runtime/main.cjs');
const standard={title:'资料审核与办理流程',style:'standard',nodes:[{id:'n1',text:'提交申请材料',type:'start'},{id:'n2',text:'资料是否齐全？',type:'decision'},{id:'n3',text:'补充缺失材料',type:'step'},{id:'n4',text:'登记并安排审核',type:'step'},{id:'n5',text:'完成办理',type:'end'}],edges:[{from:'n1',to:'n2'},{from:'n2',to:'n3',label:'否'},{from:'n2',to:'n4',label:'是'},{from:'n3',to:'n2',label:'补齐后重新检查'},{from:'n4',to:'n5'}]};
const snake={title:'程序导入 · 十二步操作流程',style:'snake',nodes:['领取任务','下载最新版程序','整合升版记录','整理工序文档','登录工作空间','选择处理能力','上传工序文档','核对转换结果','下载工序表','导入程序管理系统','检查页面展示','完成归档'].map((text,i)=>({id:'n'+i,text,type:i===0?'start':i===11?'end':'step'})),edges:Array.from({length:11},(_,i)=>({from:'n'+i,to:'n'+(i+1)}))};
fs.mkdirSync(path.join(__dirname,'../dist/checks'),{recursive:true});
test('two templates render deterministic Chinese SVG',()=>{for(const [name,d]of Object.entries({standard,snake})){const svg=render(d);assert.equal(svg,render(d));assert(svg.includes('Microsoft YaHei'));assert(!svg.includes('�'));fs.writeFileSync(path.join(__dirname,'../dist/checks',name+'.svg'),svg)}fs.writeFileSync(path.join(__dirname,'../dist/checks/fixtures.json'),JSON.stringify({standard,snake},null,2))});
test('snake refuses branches without losing source',()=>{const before=JSON.stringify(standard);assert.throws(()=>render({...standard,style:'snake'}),/蛇形/);assert.equal(JSON.stringify(standard),before)});
test('localized edit preserves unrelated data',()=>{const d=patch(snake,[{op:'text',id:'n2',text:'核对并整合升版记录'}]);assert.equal(d.nodes[2].text,'核对并整合升版记录');assert.deepEqual(d.edges,snake.edges);for(let i=0;i<12;i++)if(i!==2)assert.deepEqual(d.nodes[i],snake.nodes[i])});
test('insert into snake preserves continuous chain',()=>{const d=patch(snake,[{op:'insertAfter',id:'n2',node:{id:'added',text:'确认文档版本',type:'step'}}]);assert.equal(d.nodes.length,13);assert(d.edges.some(e=>e.from==='n2'&&e.to==='added'));assert(d.edges.some(e=>e.from==='added'&&e.to==='n3'))});
test('escaping and invalid reference handling',()=>{const d=structuredClone(snake);d.nodes[1].text='<script>alert("x")</script> & 中文';assert(!render(d).includes('<script>'));assert(render(d).includes('&lt;script&gt;'));d.edges[0].to='missing';assert.throws(()=>validate(d),/不存在/)});
test('bad model response and clarification preserve previous',async()=>{for(const raw of ['bad','{"clarification":"请确认分支"}'])await assert.rejects(()=>execute({action:'diagram',input:{mode:'edit',instruction:'改图'},api:{previous:{output:{document:snake}},resourceRoot:path.join(__dirname,'../resources'),model:async()=>raw}}));assert.equal(snake.nodes.length,12)});
test('long Chinese labels grow their nodes instead of truncation',()=>{const d=structuredClone(snake);d.nodes[2].text='这是需要完整保留的重要操作说明。'.repeat(8);const svg=render(d);assert(svg.includes('操作说明'));assert(Number(svg.match(/height="(\d+)"/)[1])>1000);fs.writeFileSync(path.join(__dirname,'../dist/checks/long.svg'),svg)});
const realStandard={"schema":1,"title":"申请提交与审批归档","style":"standard","nodes":[{"id":"n1","text":"开始","type":"start"},{"id":"n2","text":"提交申请","type":"step"},{"id":"n3","text":"检查资料是否齐全","type":"decision"},{"id":"n4","text":"补充资料","type":"step"},{"id":"n5","text":"主管审批","type":"step"},{"id":"n6","text":"通知申请人","type":"step"},{"id":"n7","text":"归档","type":"step"},{"id":"n8","text":"结束","type":"end"}],"edges":[{"from":"n1","to":"n2"},{"from":"n2","to":"n3"},{"from":"n3","to":"n4","label":"不齐全"},{"from":"n3","to":"n5","label":"齐全"},{"from":"n4","to":"n3","label":"补充后返回重新检查"},{"from":"n5","to":"n6"},{"from":"n6","to":"n7"},{"from":"n7","to":"n8"}]};
test('left branch return avoids the neighboring approval box',()=>{const svg=render(realStandard);assert(svg.includes('M 232 750 H 55 V 542 H 405'));assert(!svg.includes('M 518 750 H 1045'));});
test('read also produces a displayable artifact without a model call',async()=>{const result=await execute({action:'diagram',input:{mode:'read'},api:{previous:{output:{document:snake}}}});assert.equal(result.kind,'flowchart');assert(result.svg.includes('<svg'));assert.deepEqual(result.document,snake);});

test('extended layouts preserve every node, branch and return without mutating source',()=>{
 const before=JSON.stringify(standard);
 for(const style of ['horizontal','compact','tree','swimlane']){
  const document={...standard,style,nodes:standard.nodes.map((n,i)=>({...n,lane:i%2?'审核部门':'申请人'}))},svg=render(document);
  assert.equal((svg.match(/data-node=/g)||[]).length,standard.nodes.length);assert.equal((svg.match(/data-from=/g)||[]).length,standard.edges.length);
  for(const edge of standard.edges)assert(svg.includes('data-from="'+edge.from+'" data-to="'+edge.to+'"'));
  assert(!/NaN|undefined/.test(svg));assert.equal(render(document),svg);fs.writeFileSync(path.join(__dirname,'../dist/checks',style+'.svg'),svg);
 }
 assert.equal(JSON.stringify(standard),before);
});
test('layout availability explains missing roles and snake branches, lane edits preserve other content',()=>{
 const {choices}=require('../runtime/renderer.cjs'),options=choices(standard);
 assert.equal(options.length,6);assert.equal(options.find(l=>l.id==='snake').available,false);assert.match(options.find(l=>l.id==='swimlane').reason,/责任角色/);
 const d=patch(standard,[{op:'lane',id:'n2',lane:'审核人'}]);assert.equal(d.nodes[1].lane,'审核人');assert.deepEqual(d.edges,standard.edges);
 assert.throws(()=>render({...standard,style:'unknown'}),/受支持/);
});
test('all added layouts handle sixty nodes and long Chinese text',()=>{
 const nodes=Array.from({length:60},(_,i)=>({id:'n'+i,text:'核对完整材料并保存办理记录'.repeat(i%8===0?8:1),type:i===0?'start':i===59?'end':'step',lane:i%2?'经办人':'审核人'}));
 const edges=nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}));
 for(const style of ['horizontal','compact','tree','swimlane']){const svg=render({title:'长流程',style,nodes,edges});assert.equal((svg.match(/data-node=/g)||[]).length,60);assert(!/NaN|undefined/.test(svg));}
});

test('portable renderer matches the shared host source',()=>{assert.equal(fs.readFileSync(path.join(__dirname,'../runtime/renderer.cjs'),'utf8'),fs.readFileSync(path.join(__dirname,'../../../deepseek_harness_desktop/shared/flowchart/renderer.cjs'),'utf8'))});

// A visible connection must not imply a step that is absent from the document.
test('horizontal return avoids neighboring nodes and branch captions leave arrowheads visible',()=>{
 const svg=render({...realStandard,style:'horizontal'});
 const boxes=[...svg.matchAll(/<g data-node="([^"]+)"><rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map(m=>({id:m[1],x:+m[2],y:+m[3],w:+m[4],h:+m[5]}));
 for(const match of svg.matchAll(/<path data-from="([^"]+)" data-to="([^"]+)" d="([^"]+)"/g)){
  const tokens=match[3].split(' ');let x=+tokens[1],y=+tokens[2];const points=[[x,y]];
  for(let i=3;i<tokens.length;i+=2){if(tokens[i]==='H')x=+tokens[i+1];else if(tokens[i]==='V')y=+tokens[i+1];else assert.fail('Unexpected path command');points.push([x,y]);}
  for(let i=1;i<points.length;i++){const [ax,ay]=points[i-1],[bx,by]=points[i];for(const box of boxes.filter(b=>b.id!==match[1]&&b.id!==match[2])){const crosses=ax===bx?ax>box.x&&ax<box.x+box.w&&Math.max(ay,by)>box.y&&Math.min(ay,by)<box.y+box.h:ay>box.y&&ay<box.y+box.h&&Math.max(ax,bx)>box.x&&Math.min(ax,bx)<box.x+box.w;assert(!crosses,'edge '+match[1]+'>'+match[2]+' crosses '+box.id);}}
  const end=points.at(-1);for(const rect of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="5" fill="white"/g))assert(!(end[0]>+rect[1]&&end[0]<+rect[1]+ +rect[3]&&end[1]>+rect[2]&&end[1]<+rect[2]+ +rect[4]),'caption obscures arrowhead');
 }
 fs.writeFileSync(path.join(__dirname,'../dist/checks/horizontal-return.svg'),svg);
});
