'use strict';
// File generation only: worksheet content, formulas and appearance belong to the caller's skills.
const Workbook = require('@wekanteam/exceljs/lib/doc/workbook');
const MAX_ROWS=10000, MAX_COLS=256, MAX_CELLS=20000, MAX_BYTES=350000;
function check(ok,message){if(!ok)throw Error(message);}
function object(v){check(v&&typeof v==='object'&&!Array.isArray(v),'需要对象参数');return v;}
function list(v,max,label){check(Array.isArray(v)&&v.length<=max,label+'数量超限或格式错误');return v;}
function keys(v,allowed,label){check(Object.keys(v).every(k=>allowed.includes(k)),label+'含未支持字段');}
function number(v,min,max,label){check(Number.isFinite(v)&&v>=min&&v<=max,label+'超出范围');return v;}
function string(v,max,label){check(typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),label+'格式错误');return v;}
function cell(a){const m=/^([A-Z]{1,3})([1-9]\d*)$/.exec(a);check(m,'单元格地址无效：'+a);const c=[...m[1]].reduce((n,x)=>n*26+x.charCodeAt(0)-64,0),r=Number(m[2]);check(r<=MAX_ROWS&&c<=MAX_COLS,'单元格超出本模块范围');return{r,c};}
function range(a){string(a,30,'区域');const parts=a.split(':');check(parts.length<=2,'区域格式无效');const p=cell(parts[0]),q=cell(parts[1]??parts[0]);check(q.r>=p.r&&q.c>=p.c,'区域顺序无效');check((q.r-p.r+1)*(q.c-p.c+1)<=MAX_CELLS,'区域过大');return{p,q};}
function color(v){check(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v),'颜色须为#RRGGBB');return{argb:'FF'+v.slice(1).toUpperCase()};}
function style(raw){const s=object(raw);keys(s,['range','font','fill','alignment','border','numFmt'],'格式');const out={};
 if(s.font){const f=object(s.font);keys(f,['name','size','bold','italic','color'],'字体');out.font={};if(f.name!==undefined)out.font.name=string(f.name,80,'字体名');if(f.size!==undefined)out.font.size=number(f.size,6,72,'字号');for(const k of ['bold','italic'])if(f[k]!==undefined){check(typeof f[k]==='boolean','字体开关格式错误');out.font[k]=f[k];}if(f.color)out.font.color=color(f.color);}
 if(s.fill)out.fill={type:'pattern',pattern:'solid',fgColor:color(s.fill)};
 if(s.alignment){const a=object(s.alignment);keys(a,['horizontal','vertical','wrapText'],'对齐');if(a.horizontal!==undefined)check(['left','center','right'].includes(a.horizontal),'水平对齐无效');if(a.vertical!==undefined)check(['top','middle','bottom'].includes(a.vertical),'垂直对齐无效');if(a.wrapText!==undefined)check(typeof a.wrapText==='boolean','换行开关无效');out.alignment={...a};}
 if(s.border){const b=object(s.border);keys(b,['style','color'],'边框');check(['thin','medium','thick','dotted','dashed'].includes(b.style),'边框类型无效');const edge={style:b.style,...(b.color?{color:color(b.color)}:{})};out.border={top:edge,left:edge,bottom:edge,right:edge};}
 if(s.numFmt!==undefined)out.numFmt=string(s.numFmt,120,'数字格式');return out;
}
function formula(v,names,row){let f=string(v,1000,'公式').replaceAll('{row}',String(row)).replace(/^=/,'');check(f.trim().length>0,'公式不能为空');
 check(!/[\[\]|\r\n]/.test(f)&&!/(?:https?:|file:|\\\\)/i.test(f)&&!/(?:WEBSERVICE|HYPERLINK|RTD|CALL|EXEC|REGISTER(?:\.ID)?|SQL\.REQUEST)\s*\(/i.test(f),'仅支持工作簿内部公式，不支持外部连接或执行公式');
 check(!/#(?:REF!|DIV\/0!|VALUE!|NAME\?|NUM!|N\/A)/i.test(f),'公式含错误引用');
 for(const m of f.matchAll(/(?:'((?:[^']|'')+)'|([\p{L}\p{N}_]+))!/gu)){const name=(m[1]?.replaceAll("''", "'")??m[2]).toLowerCase();check(names.has(name),'公式引用不存在的工作表：'+name);}
 return f;
}
function scalar(v){check(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)),'单元格仅支持文本、有限数字、布尔值或null');if(typeof v==='string')string(v,32767,'单元格文本');return v;}
async function execute({action,input}){
 check(action==='generate','仅支持generate生成动作');const spec=object(input);keys(spec,['fileName','sheets'],'工作簿');
 const fileName=string(spec.fileName,150,'文件名');check(fileName.toLowerCase().endsWith('.xlsx')&&!/[\\/:*?"<>|\r\n]/.test(fileName)&&!/^\./.test(fileName),'请提供不含路径的.xlsx文件名');
 const sheets=list(spec.sheets,20,'工作表');check(sheets.length>0,'至少需要一个工作表');const names=new Set();
 for(const sheet of sheets){object(sheet);const n=string(sheet.name,31,'工作表名');check(n.trim()&&!/[\\/?*\[\]:]/.test(n)&&!/^'|'$/.test(n),'工作表名无效');check(!names.has(n.toLowerCase()),'工作表名称重复');names.add(n.toLowerCase());}
 const wb=new Workbook();wb.calcProperties={fullCalcOnLoad:true};let touched=0,formulaCount=0;const summary=[];
 const budget=n=>{touched+=n;check(touched<=200000,'格式/公式操作总量过大');};
 for(const s of sheets){keys(s,['name','rows','formulas','merges','formats','columnWidths','rowHeights','freezeRows','autoFilter'],'工作表');const ws=wb.addWorksheet(s.name);const occupied=new Set();
 const reserve=(r,c)=>{const id=r+':'+c;if(!occupied.has(id)){occupied.add(id);check(occupied.size<=MAX_CELLS,'单表最多20000个单元格');}};
 list(s.rows??[],MAX_ROWS,'数据行').forEach((row,i)=>{list(row,MAX_COLS,'列').forEach((v,j)=>{if(v===null)return;reserve(i+1,j+1);const target=ws.getCell(i+1,j+1);if(typeof v==='object'){object(v);keys(v,['formula','result'],'公式单元格');const f=formula(v.formula,names,i+1);target.value={formula:f,...(v.result===undefined?{}:{result:scalar(v.result)})};formulaCount++;}else target.value=scalar(v);});});
 for(const rule of list(s.formulas??[],500,'公式规则')){object(rule);keys(rule,['range','formula'],'公式规则');const{p,q}=range(rule.range);budget((q.r-p.r+1)*(q.c-p.c+1));for(let r=p.r;r<=q.r;r++)for(let c=p.c;c<=q.c;c++){reserve(r,c);check(ws.getCell(r,c).value===null,'公式覆盖已有值，请在数据中留空：'+ws.getCell(r,c).address);ws.getCell(r,c).value={formula:formula(rule.formula,names,r)};formulaCount++;}}
 const merges=[];for(const address of list(s.merges??[],1000,'合并区域')){const{p,q}=range(address);check(!(p.r===q.r&&p.c===q.c),'合并区域至少两个单元格');check(!merges.some(m=>p.r<=m.q.r&&q.r>=m.p.r&&p.c<=m.q.c&&q.c>=m.p.c),'合并区域重叠');budget((q.r-p.r+1)*(q.c-p.c+1));for(let r=p.r;r<=q.r;r++)for(let c=p.c;c<=q.c;c++)if(r!==p.r||c!==p.c)check(ws.getCell(r,c).value===null,'合并会丢失已有单元格内容');merges.push({p,q});ws.mergeCells(address);}
 for(const rule of list(s.formats??[],1000,'格式规则')){const{p,q}=range(rule.range),value=style(rule);budget((q.r-p.r+1)*(q.c-p.c+1));for(let r=p.r;r<=q.r;r++)for(let c=p.c;c<=q.c;c++){reserve(r,c);const target=ws.getCell(r,c),next={...target.style,...structuredClone(value)};for(const key of ['font','alignment','border'])if(value[key])next[key]={...target.style[key],...structuredClone(value[key])};target.style=next;}}
 list(s.columnWidths??[],MAX_COLS,'列宽').forEach((width,i)=>{if(width!==null)ws.getColumn(i+1).width=number(width,1,255,'列宽');});
 for(const entry of list(s.rowHeights??[],1000,'行高')){object(entry);keys(entry,['from','to','height'],'行高');const from=number(entry.from,1,MAX_ROWS,'起始行'),to=number(entry.to??from,from,MAX_ROWS,'结束行');check(Number.isInteger(from)&&Number.isInteger(to),'行号须为整数');budget(to-from+1);for(let r=from;r<=to;r++)ws.getRow(r).height=number(entry.height,1,409,'行高');}
 if(s.freezeRows!==undefined){check(Number.isInteger(s.freezeRows),'冻结行数须为整数');number(s.freezeRows,0,MAX_ROWS,'冻结行');ws.views=[{state:'frozen',ySplit:s.freezeRows}];}
 if(s.autoFilter!==undefined){range(s.autoFilter);ws.autoFilter=s.autoFilter;}
 summary.push({name:s.name,rows:ws.rowCount,columns:ws.columnCount});
 }
 const bytes=Buffer.from(await wb.xlsx.writeBuffer());check(bytes.length<=MAX_BYTES,'生成文件超过350KB，请减少内容或拆分工作簿');
 return{kind:'xlsx',fileName,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:bytes.toString('base64'),sheets:summary,formulaCount,recalculation:'公式已写入；未计算的公式由Excel/WPS打开后重算。'};
}
module.exports={execute};
