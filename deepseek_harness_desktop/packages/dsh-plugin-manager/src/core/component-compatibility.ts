/** Local.14 introduced persistent component restrictions. Retired or revoked entries cannot be silently ignored by an older service. */
export function componentRollbackIssue(packageName: string, target: { version?: string; dshComponentRegistryVersion?: number }, registry: unknown): string | undefined {
  if (packageName !== '@linxin666/dsh-capabilities' || registry === undefined) return
  const local = /^0\.1\.0-local\.(\d+)$/.exec(target.version ?? '')
  if ((target.dshComponentRegistryVersion ?? 0) >= 1 || local && Number(local[1]) >= 14) return
  const value = registry as { schema?: number; metadata?: Record<string, { enabled?: boolean; retiredAt?: string; revokedAt?: number }> }
  if (value?.schema !== 1 || !value.metadata || Object.values(value.metadata).some(m => m.enabled === false || m.retiredAt || m.revokedAt)) return '旧服务不能识别组件级停用、撤权或回收站限制，不能回退到此版本。登记信息与业务数据保留，请使用兼容这些限制的修复包。'
}
