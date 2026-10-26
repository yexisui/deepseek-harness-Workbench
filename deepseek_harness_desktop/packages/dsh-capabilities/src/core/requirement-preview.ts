/** Read-only visual structure derived from an original DOCX; never persisted in task/model context. */
export type PreviewStyle = {font?:string;size?:number;bold?:boolean;italic?:boolean;underline?:boolean;color?:string;background?:string;align?:'left'|'right'|'center'|'justify';before?:number;after?:number;indent?:number;line?:number}
export type PreviewRun = {text?:string;image?:string;style:PreviewStyle;width?:number;height?:number;alt?:string}
export type PreviewParagraph = {type:'paragraph';id:string;runs:PreviewRun[];style:PreviewStyle;heading:boolean;pageBreak?:boolean}
export type PreviewCell = {colSpan:number;rowSpan:number;nodes:PreviewNode[];background?:string;vertical?:'top'|'center'|'bottom'}
export type PreviewTable = {type:'table';id:string;columns:number[];rows:{cells:PreviewCell[];header:boolean}[]}
export type PreviewNode = PreviewParagraph|PreviewTable
export type RequirementPreview = {asset:string;body:PreviewNode[];headers:PreviewNode[];footers:PreviewNode[];images:Record<string,string>}
