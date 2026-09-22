/** Shared appearance values; this module is safe to import from the browser. */
export const roleIconIds = ['analyst', 'marketing', 'manager', 'developer', 'chat', 'chart', 'book', 'document', 'search', 'support', 'briefcase', 'idea', 'browser'] as const
export type RoleIconId = typeof roleIconIds[number]
export type RoleIconSpec = { kind: 'builtin'; id: RoleIconId } | { kind: 'png'; assetId: string }
export const roleIconAssetIdPattern = /^[a-f0-9]{64}$/
