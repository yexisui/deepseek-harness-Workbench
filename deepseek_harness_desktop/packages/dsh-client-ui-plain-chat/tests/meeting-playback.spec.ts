// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { playAt } from '../src/client/meeting-playback.ts'
it('waits for metadata and seek completion before playing a nonzero source', async () => {
 const media=document.createElement('audio');let ready=0;Object.defineProperty(media,'readyState',{get:()=>ready});Object.defineProperty(media,'duration',{value:180});const play=vi.spyOn(media,'play').mockResolvedValue();const task=playAt(media,42,new AbortController().signal)
 expect(media.currentTime).toBe(0);ready=1;media.dispatchEvent(new Event('loadedmetadata'));await vi.waitFor(()=>expect(media.currentTime).toBe(42));expect(play).not.toHaveBeenCalled();media.dispatchEvent(new Event('seeked'));await task;expect(play).toHaveBeenCalledOnce()
})
it('rejects out of range timing and surfaces playback failure',async()=>{const media=document.createElement('audio');Object.defineProperty(media,'readyState',{value:1});Object.defineProperty(media,'duration',{value:10});await expect(playAt(media,12,new AbortController().signal)).rejects.toThrow('超出');vi.spyOn(media,'play').mockRejectedValue(new Error('blocked'));await expect(playAt(media,0,new AbortController().signal)).rejects.toThrow('无法自动播放')})
it('cancels pending metadata work and releases listeners',async()=>{const media=document.createElement('audio');const controller=new AbortController();const task=playAt(media,2,controller.signal);controller.abort();await expect(task).rejects.toThrow('已取消');})
