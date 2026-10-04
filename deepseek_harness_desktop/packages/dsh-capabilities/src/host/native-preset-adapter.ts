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
