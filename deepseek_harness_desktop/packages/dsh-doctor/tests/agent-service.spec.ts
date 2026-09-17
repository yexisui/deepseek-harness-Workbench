import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path/posix'
import { describe, expect, it } from 'vitest'
import { legacyServicePlan, removeLegacyService, type ServiceRunner } from '../src/agent/service.ts'

describe('legacy service plan', () => {
  it('targets the macOS LaunchAgent plist and its bootout command', () => {
    const plan = legacyServicePlan('darwin', { HOME: '/Users/u' }, '/Users/u')
    expect(plan.files).toEqual(['/Users/u/Library/LaunchAgents/com.dsh.doctor.plist'])
    expect(plan.uninstall[0]).toBe('launchctl')
    expect(plan.uninstall[1]).toBe('bootout')
    expect(plan.uninstall[2]).toContain('gui/')
    expect(plan.uninstall[3]).toBe('/Users/u/Library/LaunchAgents/com.dsh.doctor.plist')
  })

  it('targets the systemd user unit on Linux', () => {
    const plan = legacyServicePlan('linux', { XDG_CONFIG_HOME: '/home/u/.config' }, '/home/u')
    expect(plan.files).toEqual(['/home/u/.config/systemd/user/com.dsh.doctor.service'])
    expect(plan.uninstall).toEqual(['systemctl', '--user', 'disable', '--now', 'com.dsh.doctor.service'])
  })

  it('targets the Windows scheduled task scripts', () => {
    const plan = legacyServicePlan('win32', { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' }, 'C:\\Users\\u')
    expect(plan.files).toEqual([
      'C:\\Users\\u\\AppData\\Local\\DSH Doctor\\supervisor.cmd',
      'C:\\Users\\u\\AppData\\Local\\DSH Doctor\\supervisor.vbs',
    ])
    expect(plan.uninstall).toEqual(['schtasks', '/Delete', '/F', '/TN', 'DSH Doctor Supervisor'])
  })

  it('returns an empty plan on platforms that never had a service', () => {
    expect(legacyServicePlan('freebsd', {}, '/home/u')).toEqual({ files: [], uninstall: [] })
  })
})

describe('removeLegacyService', () => {
  it('deletes an existing registration, runs the unregister command, and reports the removal', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-doctor-legacy-'))
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    try {
      const plist = join(dir, 'Library', 'LaunchAgents', 'com.dsh.doctor.plist')
      await mkdir(join(dir, 'Library', 'LaunchAgents'), { recursive: true })
      await writeFile(plist, '<?xml version="1.0"?>\n', 'utf8')
      const calls: string[][] = []
      const runner: ServiceRunner = async command => { calls.push(command) }
      await expect(removeLegacyService(runner, { HOME: dir }, dir)).resolves.toBe(true)
      expect(calls.map(call => call.slice(0, 2))).toEqual([['launchctl', 'bootout']])
      await expect(stat(plist)).rejects.toThrow()
    } finally {
      Object.defineProperty(process, 'platform', { value: original })
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('is a no-op when nothing is registered', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-doctor-legacy-'))
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    try {
      const calls: string[][] = []
      const runner: ServiceRunner = async command => { calls.push(command) }
      await expect(removeLegacyService(runner, { HOME: dir }, dir)).resolves.toBe(false)
      expect(calls).toEqual([])
    } finally {
      Object.defineProperty(process, 'platform', { value: original })
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('tolerates a failing unregister command after deleting the files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsh-doctor-legacy-'))
    const original = process.platform
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    try {
      const plist = join(dir, 'Library', 'LaunchAgents', 'com.dsh.doctor.plist')
      await mkdir(join(dir, 'Library', 'LaunchAgents'), { recursive: true })
      await writeFile(plist, '<?xml version="1.0"?>\n', 'utf8')
      const runner: ServiceRunner = async () => { throw new Error('not loaded') }
      await expect(removeLegacyService(runner, { HOME: dir }, dir)).resolves.toBe(true)
      await expect(stat(plist)).rejects.toThrow()
    } finally {
      Object.defineProperty(process, 'platform', { value: original })
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('supervisor module surface', () => {
  it('no longer exposes service installation helpers', async () => {
    const mod = (await import('../src/agent/service.ts')) as unknown as Record<string, unknown>
    expect(mod.ensureServiceInstalled).toBeUndefined()
    expect(mod.servicePlan).toBeUndefined()
    expect(typeof mod.removeLegacyService).toBe('function')
  })
})
