/**
 * Mobile remote control for the dsh web GUI — host half. Mounts the pairing
 * service (one-time tokens, device sessions, revocation), the /api/pair
 * route family (issue/accept/stop/heartbeat/status/events), the api/gate
 * listener that enforces pairing on every other /api request from
 * non-loopback hosts, and the presence sweep. The browser half (the
 * `./client` entry) renders the sidebar entry, the pairing panel, and the
 * phone-side pair/accept + deep-link flow.
 */

import { join } from 'node:path'
import { setInterval as nodeSetInterval, setTimeout as nodeSetTimeout } from 'node:timers'
import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
// Type-only: pulls the host-side Context merge (ctx.connection, whose
// authenticatedUrl the /pair-accept redirect consumes).
import type {} from '@deepseek-ai/dsh-client-connection'
import { DEFAULT_IDLE_EXPIRE_MS, PairingService, type PairingConfig } from './pairing.ts'
import { dshHome } from './dsh-home.ts'
import { isPairedDeviceRequest, makeGateListener } from './gate.ts'
import { RemoteWebUiPairing } from './pairing-access.ts'
import { makeRoutes } from './routes.ts'
import { makeRemoteApiRoutes, makeRemoteApiUpgradeRoutes } from './remote-api.ts'
import { startRemotePresencePet, type PresencePetSeam } from './remote-presence-pet.ts'
import { claimPostureKey, postureTargets, probePosture, releasePostureKey } from './posture.ts'
import { lanIPv4Addresses } from './lan.ts'
import { ensureFirewallRule, firewallSummary, removeFirewallRule } from './firewall.ts'
import { lanBindState, writeLanBind } from './lan-bind.ts'
import { desiredBindHost, desiredBindPort, firewallActionNeeded, pendingRestartOf, type AppliedFirewallState, type StartupFacts } from './lan-bind-plan.ts'
import { createInnerAuth } from './inner-auth.ts'
import { mountOnce } from './mount-once.ts'
import { REMOTE_CHANNEL_BOOT_SCRIPT } from './remote-channel-boot.ts'
import { UUID_POLYFILL_SCRIPT } from './uuid-polyfill.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Waterfall seam on the /api transport fence: the connection plugin
     * fires this per /api request before bridging to the API proxy on
     * deployments that carry the pairing/revocation seam; call `next()` to
     * delegate, return false (without calling it) to veto with 403.
     *
     * Cohort note (0.1.2-alpha.2): the official runtime ships NO emitter
     * for this event, so the listener below never fires there and direct
     * /api stays under the harness fence + browser auth. It is wired anyway
     * so cohort lines that do carry the seam get pairing enforcement on
     * direct /api without a plugin change.
     */
    'api/gate'(
      this: Context,
      request: IncomingMessage,
      method: string | undefined,
      next: () => boolean | Promise<boolean>,
    ): boolean | Promise<boolean>
  }
}

/** Stable cordis plugin name. */
export const name = 'remote-web-ui'

/** Services required before the pairing surfaces can mount. */
export const inject = ['webServer', 'typertGateway', 'connection']

/**
 * Settings namespace of the remote-control capability — the section the web
 * settings surface edits. Spelled here rather than imported: the browser
 * half spells the same value and must not depend on a Host package.
 */
export const REMOTE_WEB_UI_SETTINGS_NAMESPACE = 'remote-web-ui' as SettingsNamespace

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Token lifetime in ms; the QR link dies after this. */
  tokenTtlMs?: number
  /** A device is "online" while its lastSeenAt is newer than this (ms). */
  offlineAfterMs?: number
  /** Hard cap on paired device sessions (oldest evicted when full). */
  maxDevices?: number
  /**
   * Idle sessions older than this (ms) are deleted from memory and disk.
   * Default is 30 days; a leftover cookie no longer authorizes after expiry.
   */
  idleExpireMs?: number
  /** Cookie name carrying the paired device id. */
  cookieName?: string
  /**
   * When true (default), a desktop Web GUI opened at a non-loopback origin
   * rides the gated `/remote/api` channel and must carry a live paired-device
   * cookie — the QR is the only way into remote desktop, and stop()/revoke()
   * cut the /remote channel and the pairing cookie off immediately. Scope
   * note for this cohort: direct /api is governed by the harness fence +
   * browser-auth cookie (the api/gate seam has no emitter on 0.1.2-alpha.2),
   * so a harness browser credential a device has already redeemed is not
   * invalidated by stop() — see the README security model. Set false to keep
   * the desktop on plain `/api` (only useful when that origin is already
   * trusted for `/api`).
   */
  requirePairingForLan?: boolean
  /**
   * Extra trusted host authorities (exact host:port or port-less host) allowed
   * to access pairing endpoints and remote web services. Useful in Docker, reverse proxy,
   * or NAT environments where incoming request Host headers differ from the container's
   * internal network addresses. Can also be set via the DSH_REMOTE_TRUSTED_HOSTS env var.
   */
  trustedHosts?: string[]
  /**
   * Absolute path to a JSON file where paired device sessions are persisted.
   * Defaults to `$DSH_HOME/remote-web-ui-devices.json` so a paired device
   * keeps its session across `dsh web` restarts (the cookie already lives
   * 365 days). Override to another absolute path when needed.
   */
  devicesFile?: string
  /**
   * LAN bind toggle. When the user flips it (true or false) the plugin
   * writes the managed webserver block into the profile patch — true pins
   * the bind default to 0.0.0.0 (an explicit --host flag still wins), false
   * pins it back to 127.0.0.1 — and maintains the matching host firewall
   * rule (Windows netsh; Linux firewalld/ufw/iptables; other platforms
   * report the firewall as unmanaged). The block takes effect when the
   * process next applies the profile — the live patch watcher recomposes on
   * some profile shapes, otherwise on the next start — and the settings
   * card reports the divergence (pendingRestart) instead of guessing.
   * While the toggle has never been set (undefined), the plugin does not
   * touch the patch file at all.
   */
  lanBind?: boolean
  /**
   * The profile whose cordis.patch.yml the LAN bind toggle manages.
   * Defaults to the DSH_PROFILE environment variable, then "web". Must be
   * a single safe path segment (the DSH_PROFILE env fallback bypasses this
   * schema, so the path builder asserts containment independently).
   */
  profile?: string
  /** Master switch for the plugin (browser half + host pairing surfaces). */
  enabled?: boolean
}

export const Config: z<Config> = z.object({
  tokenTtlMs: z.number().step(1).min(60_000).default(10 * 60_000),
  offlineAfterMs: z.number().step(1).min(5_000).default(25_000),
  maxDevices: z.number().step(1).min(1).max(64).default(4),
  idleExpireMs: z.number().step(1).min(60_000).default(DEFAULT_IDLE_EXPIRE_MS),
  cookieName: z.string().min(1).default('dsh_pair'),
  requirePairingForLan: z.boolean().default(true),
  trustedHosts: z.array(z.string()),
  devicesFile: z.string(),
  lanBind: z.boolean(),
  profile: z.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  enabled: z.boolean().default(true),
})

/** Presence sweep cadence (a stale device flips to disconnected within two sweeps). */
const SWEEP_INTERVAL_MS = 10_000

/** Fully resolved local pairing configuration. */
type ResolvedConfig = Required<Omit<Config, 'trustedHosts' | 'devicesFile' | 'lanBind' | 'profile'>> & {
  trustedHosts: string[] | undefined
  devicesFile: string
  /** undefined until the user flips the toggle once; undefined never writes the patch. */
  lanBind: boolean | undefined
  profile: string
}

/**
 * The single mapping from resolved plugin config to the pairing service
 * config. Both the constructed service and every live settings sync reuse
 * it, so no field can be silently dropped when the web settings surface
 * pushes a new value into the running service.
 */
export function pairingConfigOf(resolved: Pick<
  ResolvedConfig,
  'tokenTtlMs' | 'offlineAfterMs' | 'maxDevices' | 'idleExpireMs' | 'cookieName' | 'devicesFile'
>): PairingConfig {
  return {
    tokenTtlMs: resolved.tokenTtlMs,
    offlineAfterMs: resolved.offlineAfterMs,
    maxDevices: resolved.maxDevices,
    idleExpireMs: resolved.idleExpireMs,
    cookieName: resolved.cookieName,
    devicesFile: resolved.devicesFile,
  }
}

/** Default paired-session store: `$DSH_HOME/remote-web-ui-devices.json`. */
export function defaultDevicesFile(home: string = dshHome()): string {
  return join(home, 'remote-web-ui-devices.json')
}

/** Schema defaults, re-read for hand-built test contexts (the loader applies them normally). */
const DEFAULTS: ResolvedConfig = {
  tokenTtlMs: 10 * 60_000,
  offlineAfterMs: 25_000,
  maxDevices: 4,
  idleExpireMs: DEFAULT_IDLE_EXPIRE_MS,
  cookieName: 'dsh_pair',
  requirePairingForLan: true,
  trustedHosts: undefined,
  devicesFile: defaultDevicesFile(),
  lanBind: undefined,
  profile: process.env.DSH_PROFILE ?? 'web',
  enabled: true,
}

/**
 * Mount the pairing service, routes, gate listener, and presence sweep.
 * @param ctx - host plugin context carrying webServer.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export const apply = mountOnce('@linxin666/dsh-remote-web-ui', applyImpl)

function applyImpl(ctx: Context, config?: Config): void {
  const resolved: ResolvedConfig = {
    tokenTtlMs: config?.tokenTtlMs ?? DEFAULTS.tokenTtlMs,
    offlineAfterMs: config?.offlineAfterMs ?? DEFAULTS.offlineAfterMs,
    maxDevices: config?.maxDevices ?? DEFAULTS.maxDevices,
    idleExpireMs: config?.idleExpireMs ?? DEFAULTS.idleExpireMs,
    cookieName: config?.cookieName ?? DEFAULTS.cookieName,
    requirePairingForLan: config?.requirePairingForLan ?? DEFAULTS.requirePairingForLan,
    trustedHosts: config?.trustedHosts,
    devicesFile: config?.devicesFile ?? DEFAULTS.devicesFile,
    lanBind: config?.lanBind,
    profile: config?.profile ?? process.env.DSH_PROFILE ?? DEFAULTS.profile,
    enabled: config?.enabled ?? DEFAULTS.enabled,
  }
  // The live source the pairing service and the gate read: the settings
  // section once the web settings surface is served, the composition entry
  // otherwise (installSection swaps it when the namespace registers).
  let current: () => Config = () => config ?? {}
  const resolve = (): ResolvedConfig => {
    const value = current()
    return {
      tokenTtlMs: value.tokenTtlMs ?? DEFAULTS.tokenTtlMs,
      offlineAfterMs: value.offlineAfterMs ?? DEFAULTS.offlineAfterMs,
      maxDevices: value.maxDevices ?? DEFAULTS.maxDevices,
      idleExpireMs: value.idleExpireMs ?? DEFAULTS.idleExpireMs,
      cookieName: value.cookieName ?? DEFAULTS.cookieName,
      requirePairingForLan: value.requirePairingForLan ?? DEFAULTS.requirePairingForLan,
      trustedHosts: value.trustedHosts,
      devicesFile: value.devicesFile ?? DEFAULTS.devicesFile,
      lanBind: value.lanBind,
      profile: value.profile ?? process.env.DSH_PROFILE ?? DEFAULTS.profile,
      enabled: value.enabled ?? DEFAULTS.enabled,
    }
  }
  const service = new PairingService(pairingConfigOf(resolved))

  // The bind facts are known by now (webServer is an inject edge): the LAN
  // bases are frozen per process, matching the CLI's once-per-invocation
  // sampling stance. The QR can only advertise addresses the fence accepts;
  // every interface gets its own base URL so a multi-homed machine can pick
  // the network the phone can actually reach.
  // A recompose pass can hand the plugin a webServer whose facts have not
  // settled yet (host unset, port undefined); deriving LAN bases from that
  // would advertise :undefined links or clear a working set, so the bases
  // only update when both facts are readable.
  const bindKnown = (ctx.webServer.host === '0.0.0.0' || ctx.webServer.host === '127.0.0.1')
    && Number.isFinite(ctx.webServer.port)
  if (bindKnown) {
    const lanBases = ctx.webServer.host === '0.0.0.0'
      ? lanIPv4Addresses().map(address => ({ address, base: `http://${address}:${String(ctx.webServer.port)}` }))
      : []
    service.setLanBases(lanBases)
  }

  // Push a committed settings section into the service and gate. The service
  // config object is read per operation (token mint, touch, sweep), and the
  // gate re-reads its fence flag per request, so a live edit takes effect
  // without a restart. When `enabled` turns off, the pairing routes and
  // sweep timer are dropped and all device/token state is revoked, but the
  // gate listener stays mounted so a LAN-exposed /api stays behind pairing
  // (now vetoing every non-loopback request) instead of opening the fence.
  let disposeRoutes: (() => void) | undefined
  let disposeSweep: (() => void) | undefined
  // LAN-bind facts for the settings card, re-read per request so a hot
  // rebind (the patch watcher recomposes the process) and a fresh toggle
  // round are both reflected without a restart.
  let lastKnownPort: number | undefined
  let lastFirewallApplied: AppliedFirewallState | undefined
  const lanBindStatus = (): Record<string, unknown> => {
    const resolvedNow = resolve()
    let state: { blockPresent: boolean; host?: string; port?: number }
    try {
      state = lanBindState(resolvedNow.profile)
    } catch {
      // An unsafe profile value must not take the whole status endpoint down.
      state = { blockPresent: false }
    }
    const lanOn = state.host === '0.0.0.0'
    const port = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : lastKnownPort
    if (Number.isFinite(ctx.webServer.port)) lastKnownPort = ctx.webServer.port
    const startup = ctx.get('webStartup') as StartupFacts | undefined
    const desiredHost = resolvedNow.lanBind === undefined
      ? undefined
      : desiredBindHost(resolvedNow.lanBind === true, startup?.host)
    return {
      profile: resolvedNow.profile,
      setting: resolvedNow.lanBind ?? null,
      blockHost: state.host ?? null,
      bindHost: ctx.webServer.host,
      port,
      lanUrls: ctx.webServer.host === '0.0.0.0' && port !== undefined
        ? lanIPv4Addresses().map(address => `http://${address}:${String(port)}`)
        : [],
      firewall: port !== undefined ? firewallSummary(port, lanOn) : { ok: true, managed: false },
      platform: process.platform,
      // The running bind does not follow the block on every deployment (the
      // live patch watcher is profile-shape dependent): flag the divergence
      // so the card can ask for a restart instead of looking broken. The
      // comparison uses the effective desired host (a CLI --host wins over
      // the toggle), not the raw toggle.
      pendingRestart: pendingRestartOf(resolvedNow.lanBind, desiredHost, ctx.webServer.host),
    }
  }
  // The process's inner browser credential: the proxied /api re-issues to
  // 127.0.0.1, where the connection route enforces the harness browser-auth
  // cookie (authority-bound; no loopback exemption on this cohort), so a
  // device's own cookie can never satisfy the inner check. The plugin
  // redeems its own launch token once and attaches the cookie to inner
  // requests; the credential is only ever exercised behind the pairing gate
  // in remote-api.ts.
  const innerAuth = createInnerAuth(() => {
    if (!Number.isFinite(ctx.webServer.port)) return undefined
    try {
      return (ctx.connection as { authenticatedUrl?: (base: string) => string }).authenticatedUrl?.(`http://127.0.0.1:${String(ctx.webServer.port)}/`)
    } catch {
      return undefined
    }
  })
  // The official index document for the /pair-app landing, fetched from the
  // inner loopback with the process credential and cached briefly (the shell
  // is static; skins/injections settle right after boot).
  const APP_SHELL_TTL_MS = 30_000
  let appShellCache: { at: number; html: string } | undefined
  const fetchAppShell = async (): Promise<string | undefined> => {
    if (!Number.isFinite(ctx.webServer.port)) return undefined
    if (appShellCache !== undefined && Date.now() - appShellCache.at < APP_SHELL_TTL_MS) return appShellCache.html
    const cookie = await innerAuth.ready()
    try {
      const response = await fetch(`http://127.0.0.1:${String(ctx.webServer.port)}/`, {
        headers: cookie !== undefined ? { cookie } : undefined,
      })
      if (!response.ok) return undefined
      const html = await response.text()
      appShellCache = { at: Date.now(), html }
      return html
    } catch {
      return undefined
    }
  }
  const routes = [
    ...makeRoutes({
      service,
      requirePairingForLan: () => resolve().requirePairingForLan,
      lanBindStatus,
      indexDocument: fetchAppShell,
      trustedHosts: () => {
        const list: string[] = []
        const envHosts = process.env.DSH_REMOTE_TRUSTED_HOSTS
        if (typeof envHosts === 'string' && envHosts.trim() !== '') {
          for (const item of envHosts.split(',')) {
            const trimmed = item.trim()
            if (trimmed !== '') list.push(trimmed)
          }
        }
        const cfgHosts = resolve().trustedHosts
        if (Array.isArray(cfgHosts)) {
          for (const item of cfgHosts) {
            if (typeof item === 'string') {
              const trimmed = item.trim()
              if (trimmed !== '') list.push(trimmed)
            }
          }
        }
        return list
      },
    }),
    // The remote desktop channel: policy-gated `/remote` prefix that
    // re-issues fenced paths to loopback (see remote-api.ts). The live
    // requirePairingForLan is re-read per request, same as the gate listener
    // and routes above, so a stale client rewrite on an open-LAN deployment
    // proxies instead of 403ing.
    ...makeRemoteApiRoutes({
      service,
      port: ctx.webServer.port,
      requirePairingForLan: () => resolve().requirePairingForLan,
      auth: innerAuth,
    }),
  ]
  const upgrades = makeRemoteApiUpgradeRoutes({
    service,
    port: ctx.webServer.port,
    requirePairingForLan: () => resolve().requirePairingForLan,
    auth: innerAuth,
  })
  const gate = makeGateListener(service, () => resolve().requirePairingForLan, () => resolve().enabled)
  ctx.effect(() => ctx.on('api/gate', gate), 'remote-web-ui: api gate')

  // ── posture probe ─────────────────────────────────────────────────────────
  // Guardrail for the one seam this plugin cannot mount a gate into: the
  // connection plugin's /api Host fence. Forged-Host probes against every
  // advertised origin (public base + LAN bases) make a re-opened /api (a
  // re-added --trusted-host, or the SDK's LAN auto-trust under 0.0.0.0)
  // visible on the panel and the log instead of silently trusted.
  let postureKey: string | undefined
  let postureWasExposed = false
  const runPostureProbe = (): void => {
    if (!resolve().enabled) return
    const targets = postureTargets(service.publicBaseUrl, service.lanAddresses, ctx.webServer.port)
    if (targets.length === 0) {
      postureKey = undefined
      service.setPosture(undefined)
      return
    }
    const key = targets.join('|')
    const claim = claimPostureKey(postureKey, key)
    if (!claim.run) return
    postureKey = claim.next
    void probePosture({ port: ctx.webServer.port, targets }).then((snapshot) => {
      service.setPosture(snapshot)
      const exposedHosts = snapshot.hosts.filter(host => host.exposed).map(host => host.host)
      const exposed = exposedHosts.length > 0
      if (exposed && !postureWasExposed) {
        console.error(`remote-web-ui: CRITICAL — the /api fence is OPEN for [${exposedHosts.join(', ')}]: unpaired clients reach the full host API. Remove --trusted-host for these hosts (pairing covers them) or bind loopback.`)
      } else if (!exposed && postureWasExposed) {
        console.log('remote-web-ui: the /api posture probe is clean again (every advertised origin refused with 403).')
      }
      postureWasExposed = exposed
    }).catch(() => {
      // Keep the previous snapshot; drop the in-flight key so the same
      // targets retry instead of sticking on a failed round.
      postureKey = releasePostureKey(postureKey, key)
    })
  }
  // The first round waits for the connection plugin's /api route: a probe
  // before it mounts would read the SPA fallback and false-positive.
  const initialPostureTimer = nodeSetTimeout(() => { runPostureProbe() }, 5_000)
  initialPostureTimer.unref()
  ctx.effect(() => () => { clearTimeout(initialPostureTimer) }, 'remote-web-ui: posture probe boot')
  // Sibling plugins (dsh-better-sidebar, …) look this up by name. Absent when this
  // plugin is not installed; stop() / enabled=false still refuse cookies.
  new RemoteWebUiPairing(ctx, (request) => {
    if (!resolve().enabled) return false
    return isPairedDeviceRequest(service, request)
  })

  // Remote-presence to pet-visibility link: while a paired device is online
  // (an active phone mirror), hide the host-global pet through the pet's OWN
  // hide switch; when the last device has been offline for a grace window,
  // show it again (user design; the pet plugin is optional, so the seam is
  // resolved per transition and every failure degrades to a no-op).
  const presencePet = startRemotePresencePet({
    onState: listener => service.onState(listener),
    pet: (): PresencePetSeam | undefined => {
      try {
        return ctx.get('pet') as unknown as PresencePetSeam | undefined
      } catch {
        return undefined
      }
    },
  })
  ctx.effect(() => presencePet, 'remote-web-ui: remote-presence pet visibility')

  if (service.lanAddresses.length > 0) {
    const urls = service.lanAddresses.map(ip => `http://${ip}:${String(ctx.webServer.port)}`).join(' , ')
    console.log(`remote-web-ui: the paired Web GUI is reachable on LAN at ${urls}`)
  }
  // Cohort honesty (see the README security model): the pairing gate covers
  // the plugin's own /remote channel; direct /api from LAN origins is
  // governed by the harness fence + browser-auth cookie, and this cohort's
  // api/gate seam has no emitter — so stop()/revoke() cannot invalidate a
  // browser credential a device has already redeemed.
  if (ctx.webServer.host === '0.0.0.0') {
    console.warn('remote-web-ui: LAN-exposed bind — pairing gates the /remote channel; direct /api stays under the harness fence + browser auth (stop() does not revoke an already-redeemed browser credential)')
  }

  const sync = (): void => {
    const value = resolve()
    service.config = pairingConfigOf(value)
    // LAN bind toggle: only write the managed patch block once the user has
    // flipped it (undefined = untouched, never write). Desired host/port come
    // from the CLI flags when given (flags win), else from the toggle and
    // the currently bound port. The block takes effect on the next start, so
    // the re-assert at every boot keeps it in sync with both the toggle and
    // the flags.
    if (value.lanBind !== undefined) {
      const startup = ctx.get('webStartup') as StartupFacts | undefined
      const desiredHost = desiredBindHost(value.lanBind === true, startup?.host)
      const desiredPort = desiredBindPort(startup?.port, Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : undefined)
      if (desiredPort === undefined) {
        console.error('remote-web-ui: cannot assert the lan-bind block — the web server port is not known yet')
      } else {
        try {
          const current = lanBindState(value.profile)
          if (current.host !== desiredHost || current.port !== desiredPort) {
            writeLanBind(desiredHost, desiredPort, value.profile)
            console.log(`remote-web-ui: lan-bind block written for profile ${value.profile} (${desiredHost}:${String(desiredPort)}); it takes effect when the profile next applies (the card reports pendingRestart until the running bind follows)`)
          }
        } catch (error) {
          console.error(`remote-web-ui: failed to write the lan-bind block: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      // Keep the firewall rule aligned with the toggle (managed platforms
      // only; see firewall.ts). The probes and rule rewrites are blocking
      // subprocesses, so they run only when the desired state actually moved
      // — not on every unrelated settings save. The port is the live bind
      // port; without it there is nothing to align yet.
      const livePort = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : undefined
      if (livePort === undefined) {
        console.error('remote-web-ui: cannot align the host firewall rule — the web server port is not known yet')
      } else {
        const nextFirewall: AppliedFirewallState = { enabled: value.lanBind === true, port: livePort }
        if (firewallActionNeeded(lastFirewallApplied, nextFirewall)) {
          const ruleOk = nextFirewall.enabled ? ensureFirewallRule(nextFirewall.port) : removeFirewallRule(nextFirewall.port)
          if (ruleOk) {
            lastFirewallApplied = nextFirewall
          } else {
            console.error('remote-web-ui: the host firewall rule could not be updated (admin rights required on managed platforms)')
          }
        }
      }
    }
    const enabled = value.enabled
    if (!enabled) service.stop()
    if (disposeRoutes === undefined && enabled) {
      disposeRoutes = ctx.effect(
        () => {
          const disposers = [
            ...routes.map(route => ctx.webServer.register(route)),
            ...upgrades.map(route => ctx.webServer.registerUpgrade(route)),
          ]
          return () => { for (const dispose of disposers) dispose() }
        },
        'remote-web-ui: pairing routes',
      )
    } else if (disposeRoutes !== undefined && !enabled) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    if (disposeSweep === undefined && enabled) {
      disposeSweep = ctx.effect(
        () => {
          const timer = nodeSetInterval(() => { service.sweep() }, SWEEP_INTERVAL_MS)
          timer.unref()
          return () => { clearInterval(timer) }
        },
        'remote-web-ui: presence sweep',
      )
    } else if (disposeSweep !== undefined && !enabled) {
      disposeSweep()
      disposeSweep = undefined
    }
    // Settings may change the reachable LAN posture:
    // re-probe unless the target set is unchanged.
    runPostureProbe()
  }
  // Inject the crypto.randomUUID polyfill before any other script runs, so that
  // the main bundle doesn't crash on non-secure contexts (LAN HTTP)
  ctx.effect(() => ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'script', placement: 'head', text: UUID_POLYFILL_SCRIPT })
  }), 'remote-web-ui: uuid polyfill')

  // Issue #987: the browser-half channel patch installs at this plugin's
  // boot entry, but dsh-client-connection boots earlier and opens its event
  // streams unrewritten — on a non-loopback origin the SDK fence rejects
  // them and the workspace list never loads. Contribute the rewrite as a
  // parse-time head script so it is active before ANY boot entry runs; the
  // client apply adopts the installed seat instead of patching twice. The
  // row follows the live steady-state decision (enabled + pairing gate); the
  // script itself skips loopback origins.
  ctx.effect(() => ctx.on('webserver/index-inject', (table) => {
    const value = resolve()
    if (!value.enabled || !value.requirePairingForLan) return
    table.push({ kind: 'script', placement: 'head', text: REMOTE_CHANNEL_BOOT_SCRIPT })
  }), 'remote-web-ui: remote channel boot patch')

  ctx.inject(['settings'], (settingsCtx) => {
    try {
      if (typeof settingsCtx.settings?.installSection === 'function') {
        settingsCtx.settings.installSection(ctx, REMOTE_WEB_UI_SETTINGS_NAMESPACE, Config, config ?? {}, {
          setSource: (source) => {
            current = source
            sync()
          },
          onChange: sync,
        })
      } else if (typeof settingsCtx.settings?.register === 'function') {
        const scope = settingsCtx.settings.register(REMOTE_WEB_UI_SETTINGS_NAMESPACE, Config, { base: config ?? {} })
        current = () => scope?.get?.() ?? (config ?? {})
        scope?.watch?.(() => { sync() })
        sync()
      }
    } catch {
      // Defensive fallback against settings registration differences
    }
  })
  sync()
}
