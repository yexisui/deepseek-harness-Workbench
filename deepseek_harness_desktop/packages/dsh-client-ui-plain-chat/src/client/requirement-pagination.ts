/** Pixel measurements come from the browser at the template's unscaled paper width. */
export type FlowBlock={height:number;cuts?:number[];repeat?:number;split?:boolean;before?:boolean;after?:boolean;keepNext?:boolean;section:number}
export type PageFragment={index:number;start:number;height:number}
export type DocumentPage={section:number;fragments:PageFragment[]}
export function paginateRequirement(blocks:FlowBlock[],capacity:(section:number)=>number):DocumentPage[]{
 const pages:DocumentPage[]=[];let page:DocumentPage={section:blocks[0]?.section??0,fragments:[]},used=0
 const flush=()=>{if(page.fragments.length)pages.push(page);page={section:page.section,fragments:[]};used=0}
 for(const [index,b] of blocks.entries()){
  if(b.section!==page.section||b.before){flush();page.section=b.section}
  const max=Math.max(24,capacity(b.section)),height=Math.max(0,b.height)
  if(height===0){if(b.after)flush();continue}
  if(b.keepNext&&height+(blocks[index+1]?.height??0)<=max&&used+height+(blocks[index+1]?.height??0)>max)flush()
  if(used&&height>max-used&&!b.split&&height<=max)flush()
  let start=0
  do{
   const repeat=start>0?Math.min(b.repeat??0,max/2):0,available=Math.max(1,max-used-repeat),remaining=height-start
   if(remaining<=available+.5){page.fragments.push({index,start,height:remaining});used+=remaining+repeat;break}
   const cut=b.cuts?.filter(c=>c>start+.5&&c<=start+available+.5).at(-1)
   if(cut===undefined&&used){flush();continue}
   // Oversized paragraphs/images still continue; they cannot lengthen an A4 page indefinitely.
   const end=cut??Math.min(height,start+available)
   page.fragments.push({index,start,height:end-start});start=end;flush()
  }while(start<height)
  if(b.after)flush()
 }
 flush();return pages.length?pages:[{section:0,fragments:[]}]
}
