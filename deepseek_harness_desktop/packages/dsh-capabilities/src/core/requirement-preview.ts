/** Read-only visual structure derived from an original DOCX; never persisted in task/model context. */
export type PreviewBorder = {width:number;color:string;style:'solid'|'dotted'|'dashed'|'double'|'none'}
export type PreviewBorders = Partial<Record<'top'|'bottom'|'left'|'right'|'insideH'|'insideV',PreviewBorder>>
export type PreviewStyle = {font?:string;latinFont?:string;tracking?:number;size?:number;bold?:boolean;italic?:boolean;underline?:boolean;color?:string;background?:string;align?:'left'|'right'|'center'|'justify';before?:number;after?:number;indent?:number;left?:number;right?:number;line?:number;linePoints?:number;borders?:PreviewBorders}
export type PreviewRun = {text?:string;field?:'PAGE'|'NUMPAGES'|'SECTIONPAGES';image?:string;style:PreviewStyle;width?:number;height?:number;alt?:string}
export type PreviewParagraph = {type:'paragraph';id:string;runs:PreviewRun[];style:PreviewStyle;heading:boolean;pageBreak?:boolean;breakAfter?:boolean;keepNext?:boolean;section?:number}
export type PreviewCell = {colSpan:number;rowSpan:number;nodes:PreviewNode[];background?:string;vertical?:'top'|'center'|'bottom';borders?:PreviewBorders;margins?:Partial<Record<'top'|'bottom'|'left'|'right',number>>}
export type PreviewTable = {type:'table';id:string;columns:number[];borders?:PreviewBorders;margins?:PreviewCell['margins'];width?:number;align?:'left'|'center'|'right';rows:{cells:PreviewCell[];header:boolean}[];section?:number}
export type PreviewNode = PreviewParagraph|PreviewTable
export type PreviewPage = {width:number;height:number;top:number;bottom:number;left:number;right:number;header:number;footer:number;first?:boolean;even?:boolean;headers?:Partial<Record<'default'|'first'|'even',string>>;footers?:Partial<Record<'default'|'first'|'even',string>>}
export const A4_PAGE:PreviewPage={width:595.3,height:841.9,top:56.7,bottom:56.7,left:56.7,right:56.7,header:28.35,footer:28.35}
export type RequirementPreview = {asset:string;body:PreviewNode[];headers:PreviewNode[];footers:PreviewNode[];images:Record<string,string>;pages?:PreviewPage[]}
