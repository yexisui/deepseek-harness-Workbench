import {expect,it,vi} from 'vitest'
import * as fs from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {replaceFile} from '../src/host/replace-file.ts'
vi.mock('node:fs/promises',async importOriginal=>{const actual=await importOriginal<typeof import('node:fs/promises')>();return {...actual,rename:vi.fn(actual.rename)}})

it('retries a temporarily held file without deleting the saved original',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'knowledge-replace-')),original=join(root,'saved.json'),temp=join(root,'next.tmp'),rename=(await vi.importActual<typeof fs>('node:fs/promises')).rename
 await fs.writeFile(original,'old');await fs.writeFile(temp,'new')
 const spy=vi.spyOn(fs,'rename').mockImplementationOnce(async()=>{expect(await fs.readFile(original,'utf8')).toBe('old');throw Object.assign(Error('busy'),{code:'EPERM'})}).mockImplementation(rename)
 try{await replaceFile(temp,original);expect(await fs.readFile(original,'utf8')).toBe('new');expect(spy).toHaveBeenCalledTimes(2)}finally{spy.mockRestore();await fs.rm(root,{recursive:true,force:true})}
})
it('keeps the original and candidate intact when replacement cannot succeed',async()=>{
 const root=await fs.mkdtemp(join(tmpdir(),'knowledge-replace-')),original=join(root,'saved.json'),temp=join(root,'next.tmp')
 await fs.writeFile(original,'old');await fs.writeFile(temp,'new');const spy=vi.spyOn(fs,'rename').mockRejectedValue(Object.assign(Error('access denied'),{code:'EACCES'}))
 try{await expect(replaceFile(temp,original)).rejects.toThrow('access denied');expect(await fs.readFile(original,'utf8')).toBe('old');expect(await fs.readFile(temp,'utf8')).toBe('new');expect(spy).toHaveBeenCalledTimes(6)}finally{spy.mockRestore();await fs.rm(root,{recursive:true,force:true})}
})
