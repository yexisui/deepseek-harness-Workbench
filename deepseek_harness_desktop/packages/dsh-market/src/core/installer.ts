/** Passive compatibility contracts for existing locally installed assets. No network installer. */
export const MARKET_ORIGIN = 'https://dsh-market.com'
export const PROVENANCE_FILENAME = 'dsh-market.provenance.json'

/** Build-time cap shared with scripts/market-build. */
export const MAX_FILES_PER_ASSET = 2000
export type MarketKind = 'skin' | 'pet' | 'preset'

export interface InstallProvenance {
  version: 1
  source: typeof MARKET_ORIGIN
  kind: MarketKind
  id: string
  installedAt: string
  /** Market manifest version at install time, when the manifest carried one. */
  assetVersion?: string
  files: Record<string, string>
}


const SAFE_REL_RE = /^[A-Za-z0-9._][A-Za-z0-9._\-/]{0,199}$/

/** Whether one manifest-relative path passes the conservative allowlist. */
export function isSafeRel(rel: string): boolean {
  if (typeof rel !== 'string' || !SAFE_REL_RE.test(rel)) return false
  if (rel.includes('..') || rel.includes('//') || rel.startsWith('/') || rel.endsWith('/')) return false
  return true
}

