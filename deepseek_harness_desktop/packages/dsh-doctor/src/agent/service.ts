import { spawn } from 'node:child_process'
import { rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { join as posixJoin } from 'node:path/posix'
import { join as win32Join } from 'node:path/win32'

/**
 * Legacy OS-service cleanup. Doctor supervisors used to run as persistent
 * login services (a macOS LaunchAgent, a systemd --user unit, a Windows
 * scheduled task) registered by the host on every boot: the registration was
 * global state written with the registering boot's own paths, so any host —
 * dev, e2e, or the desktop app — hijacked the same plist and the daemon
 * outlived every process cleanup. Supervisors now run as host-bounded child
 * processes (see host/ensure.ts); this module only removes the old
 * registrations, idempotently, so the first boot of the new doctor migrates
 * machines that still carry one.
 */

export interface LegacyServicePlan {
  /** Definition files to delete. */
  files: string[]
  /** Unregister command (launchctl bootout / systemctl disable / schtasks delete). */
  uninstall: string[]
}

export function legacyServicePlan(platform: NodeJS.Platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): LegacyServicePlan {
  const homeDir = env.HOME?.trim() || home
  if (platform === 'darwin') {
    return {
      files: [posixJoin(homeDir, 'Library', 'LaunchAgents', 'com.dsh.doctor.plist')],
      uninstall: ['launchctl', 'bootout', `gui/${process.getuid?.() ?? 0}`, posixJoin(homeDir, 'Library', 'LaunchAgents', 'com.dsh.doctor.plist')],
    }
  }
  if (platform === 'linux') {
    const config = env.XDG_CONFIG_HOME?.trim() || posixJoin(homeDir, '.config')
    const unit = posixJoin(config, 'systemd', 'user', 'com.dsh.doctor.service')
    return {
      files: [unit],
      uninstall: ['systemctl', '--user', 'disable', '--now', 'com.dsh.doctor.service'],
    }
  }
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim() || join(homeDir, 'AppData', 'Local')
    return {
      files: [win32Join(localAppData, 'DSH Doctor', 'supervisor.cmd'), win32Join(localAppData, 'DSH Doctor', 'supervisor.vbs')],
      uninstall: ['schtasks', '/Delete', '/F', '/TN', 'DSH Doctor Supervisor'],
    }
  }
  return { files: [], uninstall: [] }
}

export type ServiceRunner = (command: string[]) => Promise<void>

export async function runCommand(command: string[], timeoutMs = 30_000): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command[0]!, command.slice(1), { stdio: 'ignore' })
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolvePromise() : reject(new Error(`doctor: command failed (${code ?? 'signal'}): ${command.join(' ')}`)) })
    child.once('error', reject)
  })
}

/**
 * Remove any legacy OS service registration. Returns true when definition
 * files existed (the unregister command still runs best-effort either way —
 * a registration can outlive its files). Never throws for a missing or
 * already-removed registration.
 */
export async function removeLegacyService(run: ServiceRunner = runCommand, env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<boolean> {
  const plan = legacyServicePlan(process.platform, env, home)
  let removed = false
  for (const file of plan.files) {
    try { await stat(resolve(file)); removed = true } catch { continue }
    await rm(file, { force: true })
  }
  if (removed) await run(plan.uninstall).catch(() => undefined)
  return removed
}
