import { expect, it } from 'vitest'
import { protectManagedDeletion } from '../src/host/native-preset-adapter.ts'
it('rejects native deletion of managed versions while keeping unrelated custom deletion and disposal intact',async()=>{
 const files=new Set(['workbench-role-builtin-developer-v1','workbench-role-builtin-developer-v2','custom'])
 const service={files, async remove(id:string){this.files.delete(id)}}
 const original=service.remove, dispose=protectManagedDeletion(service)
 for(const id of [...files].filter(x=>x!=='custom'))await expect(service.remove(id)).rejects.toThrow('不能直接删除')
 expect(files.size).toBe(3);await service.remove('custom');expect(files.size).toBe(2)
 dispose();expect(service.remove).toBe(original)
})
