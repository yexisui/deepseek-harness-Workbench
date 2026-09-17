/** @vitest-environment jsdom */

/**
 * The section card's configured-provider filter: the balance card and the
 * plans tab render only providers with a resolved credential
 * (credential !== 'none'); unconfigured catalog routes never render, stale
 * unconfigured error lines neither, and the balance card distinguishes
 * "nothing configured" from "configured but no balance endpoint".
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { UsageSectionCard, type UsageSettings } from '../src/client/UsageSectionCard.tsx'
import { type UsageStoreInstance, type UsageUiState } from '../src/client/usage-store.ts'
import { emptyTotals, type ProviderSnapshotView, type UsageOverviewView } from '../src/core/types.ts'

afterEach(cleanup)

/** A wire provider row with view defaults; callers override the credential. */
function provider(row: Partial<ProviderSnapshotView> & Pick<ProviderSnapshotView, 'provider'>): ProviderSnapshotView {
  return { displayName: row.provider, credential: 'none', supported: true, ...row }
}

/** A minimal overview document: no ledger usage, one current route. */
function overview(providers: ProviderSnapshotView[]): UsageOverviewView {
  return {
    updatedAt: 1_700_000_000_000,
    providers,
    current: { provider: 'deepseek', model: '', source: 'live' },
    usage: {
      today: { date: '2026-01-01', totals: emptyTotals(), providers: [] },
      days: [],
      range: { from: '2026-01-01', to: '2026-01-01', totals: emptyTotals(), providers: [] },
    },
  }
}

/** Stable-reference store fake (a fresh object per getSnapshot would loop useSyncExternalStore). */
function fakeStore(state: UsageUiState): UsageStoreInstance {
  return { subscribe: () => () => {}, getSnapshot: () => state } as unknown as UsageStoreInstance
}

const settings = {
  getSnapshot: () => ({ status: 'ready', writable: true, value: {} }),
  set: async () => {},
  subscribe: () => () => {},
} as unknown as SettingsScope<UsageSettings>

/**
 * Mutable settings scope fake: `set` writes the value and notifies subscribers,
 * so a test drives the enable flag the way the section's checkbox does.
 */
function liveSettings(initial: UsageSettings): { scope: SettingsScope<UsageSettings>; set: (patch: UsageSettings) => void } {
  let value: UsageSettings = { ...initial }
  let listeners: Array<() => void> = []
  const scope = {
    getSnapshot: () => ({ status: 'ready', writable: true, value }),
    set: async () => {},
    subscribe: (listener: () => void) => {
      listeners.push(listener)
      return () => { listeners = listeners.filter((candidate) => candidate !== listener) }
    },
  } as unknown as SettingsScope<UsageSettings>
  return {
    scope,
    set: (patch: UsageSettings) => {
      value = { ...value, ...patch }
      for (const listener of [...listeners]) listener()
    },
  }
}

function cardProps(snapshot: UsageOverviewView): ComponentProps<typeof UsageSectionCard> {
  return {
    store: fakeStore({ snapshot, status: 'ready', error: null }),
    poll: () => {},
    refresh: () => {},
    settings,
    close: () => {},
  } as unknown as ComponentProps<typeof UsageSectionCard>
}

/** One configured balance provider, one configured plan provider, two unconfigured rows. */
const mixed = [
  provider({ provider: 'deepseek', displayName: 'DeepSeek', credential: 'env', balanceSupported: true, balance: { currency: 'CNY', totalBalance: '42.00', updatedAt: 1 } }),
  provider({ provider: 'kimi-coding', displayName: 'Kimi For Coding', credential: 'api-key', planSupported: true, plan: { windows: [{ key: '5h', percent: 12.5 }], updatedAt: 1 } }),
  provider({ provider: 'zenmux', displayName: 'ZenMux', balanceSupported: true }),
  provider({ provider: 'openai-codex', displayName: 'Codex', planSupported: true, error: 'HTTP 401' }),
]

describe('UsageSectionCard configured-provider filter', () => {
  it('renders only configured providers in the balance card', () => {
    render(<UsageSectionCard {...cardProps(overview(mixed))} />)
    expect(screen.getByText('¥42.00')).toBeTruthy()
    expect(screen.queryByText('ZenMux')).toBeNull()
    expect(screen.queryByText('未配置凭据')).toBeNull()
    expect(screen.queryByText(/HTTP 401/)).toBeNull()
  })

  it('renders only configured providers on the plans tab', () => {
    render(<UsageSectionCard {...cardProps(overview(mixed))} />)
    fireEvent.click(screen.getByRole('tab', { name: '个人套餐' }))
    expect(screen.getByText('Kimi For Coding')).toBeTruthy()
    expect(screen.queryByText('ZenMux')).toBeNull()
    expect(screen.queryByText('Codex')).toBeNull()
  })

  it('shows the none-configured empty states when no provider has a credential', () => {
    const unconfigured = [
      provider({ provider: 'zenmux', displayName: 'ZenMux', balanceSupported: true }),
      provider({ provider: 'openai-codex', displayName: 'Codex', planSupported: true }),
    ]
    render(<UsageSectionCard {...cardProps(overview(unconfigured))} />)
    expect(screen.getByText('没有已配置的提供方')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '个人套餐' }))
    expect(screen.getByText('没有已配置的套餐类 provider（如 Kimi、GLM、OpenCode Go、MiniMax、Codex 订阅）')).toBeTruthy()
  })
})

describe('Token 银行 tab', () => {
  it('shows the empty state when the DeepSeek official family has no usage', () => {
    render(<UsageSectionCard {...cardProps(overview([]))} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Token 银行' }))
    expect(screen.getByText('暂无 DeepSeek 官方用量数据（统计自插件启用起）')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '保存图片' })).toBeNull()
  })

  it('mints the voucher from the whole-ledger family rows and offers save (no share without navigator.canShare)', () => {
    const snapshot = overview([])
    snapshot.usage.all = {
      from: '2025-12-01',
      to: '2026-01-01',
      totals: emptyTotals(),
      providers: [
        { provider: 'deepseek', totals: { ...emptyTotals(), inputTokens: 1_000_000, outputTokens: 234_567, calls: 12, cost: 3.5 }, models: [] },
        { provider: 'kimi-coding', totals: { ...emptyTotals(), inputTokens: 999_999, calls: 5 }, models: [] },
      ],
    }
    render(<UsageSectionCard {...cardProps(snapshot)} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Token 银行' }))
    // 1,234,567 tokens mint 1 whale yuan at the 1,000,000:1 exchange rate.
    expect(screen.getByText('累计铸造 1 鲸元（1.23M tokens）')).toBeTruthy()
    expect(screen.getByText('消费估算：约 ¥3.50')).toBeTruthy()
    expect(screen.getByText('12 次调用')).toBeTruthy()
    expect(screen.getByText('统计窗口 2025-12-01 ~ 2026-01-01')).toBeTruthy()
    expect(screen.getByRole('button', { name: '保存图片' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '分享' })).toBeNull()
  })

  it('prefers the official balance watch over the fold-time estimate for the spend line', () => {
    const snapshot = overview([])
    snapshot.usage.all = {
      from: '2026-01-01',
      to: '2026-01-01',
      totals: emptyTotals(),
      providers: [{ provider: 'deepseek', totals: { ...emptyTotals(), inputTokens: 50_000, calls: 2, cost: 0.1 }, models: [] }],
    }
    snapshot.usage.observedSpend = { cny: 12.5, since: new Date(2026, 0, 2, 12).getTime() }
    render(<UsageSectionCard {...cardProps(snapshot)} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Token 银行' }))
    expect(screen.getByText('累计铸造 1 鲸元（50k tokens）')).toBeTruthy()
    expect(screen.getByText('官方余额实测花费 ¥12.50（自 2026-01-02 起）')).toBeTruthy()
    expect(screen.queryByText(/消费估算/)).toBeNull()
  })

  it('falls back to the 30-day trend window when an older host serves no all aggregate', () => {
    const snapshot = overview([])
    snapshot.usage.range = {
      from: '2026-01-01',
      to: '2026-01-01',
      totals: emptyTotals(),
      providers: [{ provider: 'deepseek-official', totals: { ...emptyTotals(), inputTokens: 5000, calls: 2, cost: 0.01 }, models: [] }],
    }
    render(<UsageSectionCard {...cardProps(snapshot)} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Token 银行' }))
    expect(screen.getByText('统计窗口 2026-01-01 ~ 2026-01-01')).toBeTruthy()
    expect(screen.getByRole('button', { name: '保存图片' })).toBeTruthy()
  })
})

/**
 * #1500: disabling the plugin deregisters the host routes, so the panel must
 * stop polling, say why, and keep the enable checkbox reachable — the earlier
 * panel-wide error return left no way back from the UI.
 */
describe('UsageSectionCard disabled and failed states', () => {
  it('stops polling and keeps the enable checkbox while the plugin is disabled', () => {
    const poll = vi.fn()
    const { scope } = liveSettings({ enabled: false })
    render(<UsageSectionCard {...cardProps(overview(mixed))} poll={poll} settings={scope} />)
    expect(poll).not.toHaveBeenCalled()
    expect(screen.getByText(/插件已停用/)).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })

  it('resumes polling once the plugin is enabled again', () => {
    const poll = vi.fn()
    const { scope, set } = liveSettings({ enabled: false })
    render(<UsageSectionCard {...cardProps(overview(mixed))} poll={poll} settings={scope} />)
    expect(poll).not.toHaveBeenCalled()
    act(() => { set({ enabled: true }) })
    expect(poll).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/插件已停用/)).toBeNull()
  })

  it('keeps the settings controls mounted when the overview transport fails', () => {
    const failing = fakeStore({ snapshot: null, status: 'error', error: 'usage /api/dsh-usage/overview failed: 500' })
    render(<UsageSectionCard {...cardProps(overview(mixed))} store={failing} />)
    expect(screen.getByText(/failed: 500/)).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })
})
