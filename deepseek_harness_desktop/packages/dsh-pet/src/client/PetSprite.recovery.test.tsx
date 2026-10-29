// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PetSprite, type PetSpriteProps } from './PetSprite.tsx'
import { t } from './locales.ts'
import type { PetDefinition } from '../registry.ts'

const definition = {
  id: 'test-pet', displayName: '测试宠物', description: '', renderer: 'sprite2d',
  cell: { width: 192, height: 208 }, columns: 8, atlasRows: 9, rows: Array(9).fill(1),
  tracks: Object.fromEntries(['idle','running-right','running-left','waving','jumping','failed','waiting','running','review'].map(name=>[name,{frames:[0],durations:[400],loop:true}])),
  atlasUrl: '/pet/test-pet/spritesheet.webp', manifestUrl: '/pet/test-pet/pet.json',
} as PetDefinition
let images: { onload: (() => void) | null; onerror: (() => void) | null; src: string }[]
const props = (): PetSpriteProps => ({ definition, display: {visible:true,size:160,right:38,bottom:26,bubbleScale:1}, snapshot:null, feedback:null, onPet:vi.fn(), onDragEnd:vi.fn(), onOpenSession:vi.fn(), onFeedbackDone:vi.fn(), t })

beforeEach(() => {
  document.documentElement.lang='zh'
  images=[]
  vi.stubGlobal('Image',class { onload=null; onerror=null; src=''; constructor(){images.push(this)} })
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({roles:[]})})))
  vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800)
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}))
})
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})

async function exhaust() {
  vi.useFakeTimers()
  for(const delay of [1000,2000,4000]) { act(()=>images.at(-1)!.onerror?.()); await act(()=>vi.advanceTimersByTimeAsync(delay)) }
  act(()=>images.at(-1)!.onerror?.())
}

describe('pet image recovery',()=>{
  it.each(['focus','online','visibilitychange'])('recovers an exhausted image on %s without saving settings',async event=>{
    const p=props();render(<PetSprite {...p}/>);await exhaust()
    expect(screen.getByRole('button',{name:'重新加载宠物'})).toBeTruthy()
    expect(images).toHaveLength(4)
    fireEvent(event==='visibilitychange'?document:window,new Event(event))
    expect(images).toHaveLength(5)
    act(()=>images.at(-1)!.onload?.())
    expect(screen.queryByRole('button',{name:'重新加载宠物'})).toBeNull()
    expect(screen.getByRole('button',{name:'测试宠物'}).style.backgroundImage).toContain(definition.atlasUrl)
    fireEvent(window,new Event(event));expect(images).toHaveLength(5)
    expect(p.onDragEnd).not.toHaveBeenCalled();expect(p.onPet).not.toHaveBeenCalled()
  })
  it('allows an explicit retry without triggering pet interaction',async()=>{
    const p=props();render(<PetSprite {...p}/>);await exhaust()
    fireEvent.click(screen.getByRole('button',{name:'重新加载宠物'}))
    expect(images).toHaveLength(5);expect(p.onPet).not.toHaveBeenCalled()
  })
  it('cleans up retries and ignores late image callbacks after unmount',async()=>{
    vi.useFakeTimers();const view=render(<PetSprite {...props()}/>),late=images[0].onload
    act(()=>images[0].onerror?.());view.unmount();await act(()=>vi.advanceTimersByTimeAsync(8000))
    fireEvent.focus(window);act(()=>late?.());expect(images).toHaveLength(1)
  })
  it('does not load an atlas for other renderer types',()=>{
    render(<PetSprite {...props()} visual={<canvas/>}/>);fireEvent.focus(window)
    expect(images).toHaveLength(0);expect(screen.queryByText('重新加载宠物')).toBeNull()
  })
})

describe('pet viewport placement',()=>{
  it('keeps the full pet visible after resize and preserves saved coordinates',()=>{
    const p=props();p.display={...p.display,right:950,bottom:550}
    render(<PetSprite {...p}/>);const float=screen.getByRole('button',{name:'测试宠物'}).parentElement!.parentElement!
    expect(float.style.right).toBe('950px')
    vi.stubGlobal('innerWidth',700);vi.stubGlobal('innerHeight',500);fireEvent(window,new Event('resize'))
    expect(float.style.right).toBe('552px');expect(float.style.bottom).toBe('340px')
    expect(p.onDragEnd).not.toHaveBeenCalled()
    vi.stubGlobal('innerWidth',1200);vi.stubGlobal('innerHeight',800);fireEvent(window,new Event('resize'))
    expect(float.style.right).toBe('950px');expect(float.style.bottom).toBe('550px')
  })
  it('keeps the normal hover panel within the right edge',()=>{
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {x:1052,y:340,left:1052,right:1200,top:340,bottom:500,width:148,height:160,toJSON(){}}})
    vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(220)
    const p=props();render(<PetSprite {...p} display={{...p.display,right:0,bottom:300}}/> )
    fireEvent.contextMenu(screen.getByRole('button',{name:'测试宠物'}))
    const panel=document.querySelector<HTMLElement>('[data-placement]')!
    expect(panel.style.left).toBe('-80px')
  })
})
