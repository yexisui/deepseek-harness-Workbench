// The shared renderer is the single source for preview, download and worker rendering.
// @ts-ignore CommonJS renderer shipped with the capability package; bundled by tsdown.
import renderer from '../../../../shared/flowchart/renderer.cjs'
import { InputError } from '../core/validation.ts'
import type { PackageRunner } from './package-runner.ts'

export function flowchartArtifact(runner:PackageRunner,id:string,style?:string|null) {
  const job=runner.get(id),output=job.output as {kind?:string;document?:Record<string,unknown>;svg?:string}|undefined
  if(job.status!=='done'||output?.kind!=='flowchart'||!output.document||typeof output.svg!=='string')throw new InputError('流程图尚未生成',404)
  const selected=style??job.presentation?.style??String(output.document.style)
  return {job,document:output.document,selected,svg:()=>renderer.render({...output.document,style:selected}) as string}
}
export function flowchartLayouts(runner:PackageRunner,id:string) {
  const chart=flowchartArtifact(runner,id)
  return {selected:chart.selected,layouts:renderer.choices(chart.document).map((item:any)=>({...item,previewUrl:`/api/capabilities/packages/artifact/${id}/image.svg?style=${item.id}`}))}
}
export async function selectFlowchartLayout(runner:PackageRunner,id:string,style:unknown) {
  if(typeof style!=='string')throw new InputError('请选择流程图布局')
  const chart=flowchartArtifact(runner,id,style)
  try{chart.svg()}catch(error){throw new InputError((error as Error).message)}
  await runner.present(id,style)
  return flowchartLayouts(runner,id)
}
