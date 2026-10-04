import { InputError } from '../core/validation.ts'
/** Guard the native mutation seam, retaining resolution of immutable presets for old sessions. */
export const managedPreset = (id: string) => /^workbench-role-[a-z][a-z0-9-]*-v[1-9][0-9]*$/.test(id)
export function protectManagedDeletion(service: { remove(id: string): Promise<void> }) {
  const original = service.remove
  const guarded = async function(this: typeof service, id: string) {
    if (managedPreset(id)) throw new InputError('此预设是岗位的历史版本，不能直接删除。请在岗位助手中停用或归档岗位。', 409)
    return original.call(this, id)
  }
  service.remove = guarded
  return () => { if (service.remove === guarded) service.remove = original }
}

export function protectManagedCopy(service: { copy(from: string, id: string, name?: string): Promise<void> }) {
  const original = service.copy
  const guarded = async function(this: typeof service, from: string, id: string, name?: string) {
    if (managedPreset(from) || id.startsWith('workbench-role-')) throw new InputError('岗位预设不能在此复制，请使用岗位卡片上的“复制岗位”并发布副本。', 409)
    return original.call(this, from, id, name)
  }
  service.copy = guarded
  return () => { if (service.copy === guarded) service.copy = original }
}
