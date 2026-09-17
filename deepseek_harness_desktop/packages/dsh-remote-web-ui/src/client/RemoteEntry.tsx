/** LAN pairing trigger, status stream, and device management. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PairingPhase } from '../pairing.ts'
import { RemotePanel, type PanelState } from './RemotePanel.tsx'
import { copyText, issuePair, revokePair, stopPair, type DeviceFrame, type IssueResponse, type PairStateFrame } from './pair-api.ts'
import { PhoneIcon } from './PhoneIcon.tsx'
import css from './remote.module.css'

/** Entry props: the sidebar column state and the standard locale seat. */
export type RemoteEntryProps = PropsLocale<'remote'> & {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** Apply one local status frame onto the ready pairing panel. */
function mergeFrame(state: PanelState, frame: PairStateFrame): PanelState {
  if (state.kind !== 'ready') return state
  return {
    ...state,
    phase: frame.phase,
    deviceCount: frame.deviceCount,
    onlineCount: frame.onlineCount,
    devices: frame.devices ?? [],
    ...(frame.posture !== undefined ? { posture: frame.posture } : {}),
  }
}

/**
 * Render the remote-control trigger and panel.
 * @param props - composed slot props (contract in this package).
 * @returns the entry element tree.
 */
export function RemoteEntry({ wide, t }: RemoteEntryProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PanelState>({ kind: 'lan-required' })
  const [copied, setCopied] = useState<boolean>(false)
  const [copiedToken, setCopiedToken] = useState<boolean>(false)
  const eventSource = useRef<EventSource | undefined>(undefined)
  // Generation counter for the open flow: closing (or re-opening) the panel
  // bumps it, so an in-flight issue() that resolves after a close does not
  // spawn a stray EventSource.
  const openSeq = useRef(0)

  const closeEventSource = useCallback(() => {
    eventSource.current?.close()
    eventSource.current = undefined
  }, [])

  const mint = useCallback(async (address?: string): Promise<PanelState> => {
    let result: IssueResponse
    try {
      result = await issuePair(address)
    } catch {
      // Fetch/network failure: show an explicit state instead of silently
      // leaving the panel on its initial banner.
      return { kind: 'unreachable' }
    }
    if (!result.ok) {
      // 403 is the loopback-only fence refusing a LAN origin (the panel is a
      // desktop control endpoint); 409 means the server never bound 0.0.0.0;
      // 400 means the requested LAN literal is no longer constructible.
      if (result.code === 'forbidden') return { kind: 'loopback-required' }
      if (result.code === 'unknown-address') return { kind: 'unreachable' }
      return { kind: 'lan-required' }
    }
    return {
      kind: 'ready',
      url: result.url,
      token: result.token,
      expiresAt: result.expiresAt,
      expired: Date.now() > result.expiresAt,
      phase: 'waiting',
      deviceCount: 0,
      onlineCount: 0,
      devices: [] as DeviceFrame[],
      address: address ?? result.lanAddresses[0] ?? '',
      lanAddresses: result.lanAddresses,
    }
  }, [])

  const openPanel = useCallback(async (): Promise<void> => {
    const seq = ++openSeq.current
    setOpen(true)
    const next = await mint()
    // A close (or re-open) during the await invalidates this issue: skip the
    // state write and the stream so a panel closed mid-mint neither leaks an
    // EventSource nor resurrects a stale QR.
    if (seq !== openSeq.current) return
    setState(next)
    // Only a ready LAN panel needs a local status subscription.
    if (next.kind !== 'ready') return
    const source = new EventSource('/api/pair/events')
    eventSource.current = source
    source.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as PairStateFrame
        if (frame.type !== 'state') return
        setState(current => mergeFrame(current, frame))
      } catch {
        // Malformed frames are dropped; the snapshot on open is authoritative.
      }
    }
  }, [mint])

  const closePanel = useCallback(() => {
    openSeq.current += 1
    closeEventSource()
    setOpen(false)
  }, [closeEventSource])

  // Expiry flip: one timeout per token lifetime (reset by refresh).
  useEffect(() => {
    if (state.kind !== 'ready') return
    if (state.expired) return
    const delay = state.expiresAt - Date.now()
    if (delay <= 0) {
      setState(previous => previous.kind === 'ready' ? { ...previous, expired: true } : previous)
      return
    }
    const timer = window.setTimeout(() => {
      setState(previous => previous.kind === 'ready' ? { ...previous, expired: true } : previous)
    }, delay)
    return () => { window.clearTimeout(timer) }
  }, [state])

  // Unmount safety: never leave the stream open.
  useEffect(() => closeEventSource, [closeEventSource])

  const handleStop = useCallback(() => {
    // A failed stop request is harmless: the optimistic phase flip below
    // keeps the UI honest, and the status stream confirms the stopped phase.
    void stopPair().catch(() => {})
    // Optimistic fallback; the status stream confirms with the stopped phase.
    setState(previous => previous.kind === 'ready' ? { ...previous, phase: 'stopped' as PairingPhase, devices: [] } : previous)
  }, [])

  const handleRevoke = useCallback((deviceId: string) => {
    void revokePair(deviceId).catch(() => {})
    setState(previous => previous.kind === 'ready'
      ? { ...previous, devices: previous.devices.filter(device => device.id !== deviceId) }
      : previous)
  }, [])

  const handleRefresh = useCallback(() => {
    void mint().then(setState)
  }, [mint])

  /** Re-mint against another LAN literal (multi-homed machines). */
  const handlePickAddress = useCallback((address: string) => {
    void mint(address).then(setState)
  }, [mint])

  const handleCopy = useCallback((url: string) => {
    void copyText(url).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1500)
    })
  }, [])

  const handleCopyToken = useCallback((token: string) => {
    void copyText(token).then((ok) => {
      if (!ok) return
      setCopiedToken(true)
      window.setTimeout(() => { setCopiedToken(false) }, 1500)
    })
  }, [])

  return (
    <>
      <div className={css.entryRow} data-rail={wide ? undefined : 'rail'}>
        <TooltipAnchor wide={wide} label={t('entry.label')} onClick={openPanel} expanded={open} />
      </div>
      {open && createPortal((
        <div className={css.overlay} role="presentation">
          <div className={css.mask} aria-hidden="true" onClick={closePanel} />
          <RemotePanel
            t={t}
            state={state}
            copied={copied}
            copiedToken={copiedToken}
            onClose={closePanel}
            onStop={handleStop}
            onRefresh={handleRefresh}
            onCopy={handleCopy}
            onCopyToken={handleCopyToken}
            onPickAddress={handlePickAddress}
            onRevoke={handleRevoke}
          />
        </div>
      ), document.body)}
    </>
  )
}

/** The trigger: an icon-only control with a persistent accessible label. */
function TooltipAnchor({ wide, label, onClick, expanded }: { wide: boolean; label: string; onClick: () => void; expanded: boolean }) {
  return (
    <button
      type="button"
      className={css.trigger}
      data-wide={wide ? 'wide' : 'rail'}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      onClick={onClick}
    >
      <PhoneIcon size={wide ? 16 : 18} />
    </button>
  )
}
