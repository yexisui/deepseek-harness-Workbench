import { useCallback, useEffect, useState } from 'react'

export type MeetingAvailability = { ready: boolean; state?: 'ready' | 'unconfigured' | 'disabled'; message: string; endpointHost?: string; endpoint?: string; asrModel?: string; format?: 'json' | 'verbose_json'; maxMb?: number; hasKey?: boolean; keySource?: 'saved' | 'environment' | 'none'; configSource?: 'saved' | 'environment'; editable?: boolean; revision?: number; provider?: string; maxBytes?: number }

export function useMeetingAvailability(revision?: number) {
  const [status, setStatus] = useState<MeetingAvailability | null>(null)
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/capabilities/meeting/config', { credentials: 'same-origin' })
      if (!response.ok) throw new Error(`状态读取失败（${response.status}）`)
      setStatus(await response.json() as MeetingAvailability)
    } catch (error) { setStatus({ ready: false, message: error instanceof Error ? error.message : String(error) }) }
  }, [])
  useEffect(() => {
    void refresh()
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh, revision])
  return { status, refresh }
}
